# -*- coding: utf-8 -*-
"""从下一个 Token 到现代 LLM：按正文顺序执行的数字实验。"""

# 可运行片段：BPE 的一次合并
import math
import torch
from torch import nn
import torch.nn.functional as F

torch.manual_seed(42)
torch.set_num_threads(1)

def merge_pair(tokens, pair):
    result = []
    i = 0
    while i < len(tokens):
        if i + 1 < len(tokens) and tuple(tokens[i:i + 2]) == pair:
            result.append(tokens[i] + tokens[i + 1])
            i += 2
        else:
            result.append(tokens[i])
            i += 1
    return result

parts = list("playing")
for pair in [("p", "l"), ("pl", "a"), ("pla", "y")]:
    parts = merge_pair(parts, pair)
assert parts == ["play", "i", "n", "g"]


# 可运行片段：字节、字符和码点不是同一层
encoded = "中".encode("utf-8")
assert list(encoded) == [228, 184, 173]
assert bytes([228, 184, 173]).decode("utf-8") == "中"
assert chr(228) == "ä"  # 这里把 228 当 Unicode 码点
try:
    bytes([228]).decode("utf-8")
except UnicodeDecodeError:
    pass
else:
    raise AssertionError("一个不完整的 UTF-8 前缀不能独立解码")


# 可运行片段：检查 loss 的 shape 和含义
logits = torch.zeros(2, 3, 8, requires_grad=True)
labels = torch.tensor([[1, 2, 3], [4, 5, 6]])
loss = F.cross_entropy(logits.reshape(-1, 8), labels.reshape(-1))
assert loss.ndim == 0
assert torch.allclose(loss, torch.tensor(math.log(8)))
loss.backward()
assert logits.grad.shape == (2, 3, 8)


# 可运行片段：同一分布，多个采样结果
scores = torch.tensor([2.0, 1.0, 0.0])  # [N=3]
probs = scores.softmax(dim=-1)         # [3]
assert scores.argmax().item() == 0
rng = torch.Generator().manual_seed(42)
draws = torch.multinomial(probs, 1000, replacement=True, generator=rng)
assert draws.unique().numel() == 3
print("1000 次采样计数：", torch.bincount(draws, minlength=3).tolist())


# 可运行片段：温度改变分布，不改变正温度下的第一名
for temperature in [0.5, 1.0, 2.0]:
    adjusted = (scores / temperature).softmax(-1)
    print("温度", temperature, "概率", adjusted.tolist())
    assert adjusted.argmax().item() == scores.argmax().item()


# 可运行片段：严格保留 k 个候选

def top_k_probs(logits, k):
    # logits: [...,N]，最后一维为词表；返回相同 shape
    if not 1 <= k <= logits.shape[-1]:
        raise ValueError("k 必须在 1 和词表大小之间")
    values, indices = logits.topk(k, dim=-1)
    filtered = torch.full_like(logits, -torch.inf)
    filtered.scatter_(-1, indices, values)
    return filtered.softmax(-1)

base_probs = torch.tensor([0.5, 0.3, 0.15, 0.05])
assert torch.allclose(top_k_probs(base_probs.log(), 2),
                      torch.tensor([0.625, 0.375, 0.0, 0.0]))


# 可运行片段：保留达到阈值所需的最小前缀

def top_p_probs(logits, threshold):
    if not 0 < threshold <= 1:
        raise ValueError("阈值必须在 (0,1] 内")
    sorted_logits, ids = logits.sort(dim=-1, descending=True)
    sorted_probs = sorted_logits.softmax(-1)
    # 当前 token 之前的累计概率，还没达到阈值时就保留它。
    previous_mass = sorted_probs.cumsum(-1) - sorted_probs
    keep = previous_mass < threshold
    keep[..., 0] = True
    if threshold == 1:
        keep = torch.ones_like(keep)  # 避免累计舍入误删尾部
    filtered = sorted_logits.masked_fill(~keep, -torch.inf)
    selected_probs = filtered.softmax(-1)
    return torch.zeros_like(logits).scatter(-1, ids, selected_probs)

p = torch.tensor([0.15, 0.4, 0.2, 0.25])
actual = top_p_probs(p.log(), 0.8)
assert torch.allclose(actual, torch.tensor([0., 0.4, 0.2, 0.25]) / 0.85)


# 可运行片段：带历史长度的因果遮罩
past, length = 3, 2
query_positions = torch.arange(past, past + length)[:, None]  # [2,1]
key_positions = torch.arange(past + length)[None, :]         # [1,5]
future = key_positions > query_positions                    # [2,5]
assert future.tolist() == [[False, False, False, False, True],
                           [False, False, False, False, False]]


# 可运行片段：同一组 KV，不同 Q 得到不同结果
q = torch.tensor([[1., 0.], [0., 1.]])  # [两个查询, d=2]
k = torch.eye(2)                        # [两个历史位置, d=2]
v = torch.tensor([[10., 0.], [0., 10.]])
weights = (q @ k.T / math.sqrt(2)).softmax(-1)
head_outputs = weights @ v
assert not torch.allclose(head_outputs[0], head_outputs[1])
print("共享 KV 的两个查询输出：", head_outputs.tolist())


# 可运行片段：GQA 的头映射与合并
B, L, P, d = 2, 3, 4, 8
q = torch.randn(B, 4, L, d)
k = torch.randn(B, 2, P + L, d)
v = torch.randn(B, 2, P + L, d)
expanded_k = k.repeat_interleave(2, dim=1)  # KV0,KV0,KV1,KV1
expanded_v = v.repeat_interleave(2, dim=1)
scores_gqa = q @ expanded_k.transpose(-2, -1) / math.sqrt(d)
future = torch.arange(P + L)[None, :] > torch.arange(P, P + L)[:, None]
weights_gqa = scores_gqa.masked_fill(future, -torch.inf).softmax(-1)
heads = weights_gqa @ expanded_v             # [2,4,3,8]
joined = heads.transpose(1, 2).reshape(B, L, 32)
assert joined.shape == (2, 3, 32)


# 可运行片段：多维 RoPE 与广播

def apply_rope(x, positions):
    # x: [B,H,L,d]；positions: [L]；返回同 shape
    d = x.shape[-1]
    if d % 2:
        raise ValueError("本实现旋转整个头，d 必须是偶数")
    frequencies = 10000.0 ** (-torch.arange(0, d, 2, device=x.device).float() / d)
    angles = positions[:, None] * frequencies[None, :]  # [L,d/2]
    cos = angles.cos()[None, None, :, :].to(x.dtype)    # [1,1,L,d/2]
    sin = angles.sin()[None, None, :, :].to(x.dtype)
    even = x[..., 0::2]                                # [B,H,L,d/2]
    odd = x[..., 1::2]
    out_even = even * cos - odd * sin
    out_odd = even * sin + odd * cos
    pairs = torch.stack([out_even, out_odd], dim=-1)    # [B,H,L,d/2,2]
    return pairs.flatten(-2)                           # [B,H,L,d]

x = torch.randn(2, 4, 3, 8)
rotated = apply_rope(x, torch.arange(3))
assert rotated.shape == x.shape
assert torch.allclose(rotated.square().sum(-1), x.square().sum(-1), atol=1e-5)
# 同时平移 Q、K 的位置，固定内容向量时点积不变。
q_content, k_content = torch.randn(1, 1, 1, 8), torch.randn(1, 1, 1, 8)
def rotated_dot(m, n):
    return (apply_rope(q_content, torch.tensor([m])) *
            apply_rope(k_content, torch.tensor([n]))).sum()
assert torch.allclose(rotated_dot(2, 5), rotated_dot(12, 15), atol=1e-5)


# 可运行片段：沿最后一维做 RMSNorm
class RMSNorm(nn.Module):
    def __init__(self, width, eps=1e-6):
        super().__init__()
        self.scale = nn.Parameter(torch.ones(width))  # [D]
        self.eps = eps

    def forward(self, x):
        # x: [B,L,D] 或其他以 D 为最后一维的 shape
        mean_square = x.square().mean(dim=-1, keepdim=True)  # [B,L,1]
        return x * torch.rsqrt(mean_square + self.eps) * self.scale

norm = RMSNorm(2)
a = torch.tensor([[3., 4.]])
b = torch.tensor([[30., 40.]])
assert torch.allclose(norm(a), norm(b), atol=1e-6)
assert norm(a).mean().item() > 0  # 没有减均值，不要求输出均值为 0


# 可运行片段：三个投影的 shape
class SwiGLU(nn.Module):
    def __init__(self, width, inner_width):
        super().__init__()
        self.up = nn.Linear(width, inner_width, bias=False)
        self.gate = nn.Linear(width, inner_width, bias=False)
        self.down = nn.Linear(inner_width, width, bias=False)

    def forward(self, x):
        content = self.up(x)                  # [B,L,F]
        gate = F.silu(self.gate(x))            # [B,L,F]
        return self.down(content * gate)      # [B,L,D]

u, g = torch.tensor([2., 3.]), torch.tensor([0., 1.])
assert torch.allclose(u * F.silu(g), torch.tensor([0., 2.1931758]), atol=1e-6)
ffn = SwiGLU(32, 64)
assert ffn(torch.randn(2, 3, 32)).shape == (2, 3, 32)


# 可运行片段：单个 query 的在线 softmax 加权和

def online_attention(scores, values, block_size):
    # scores: [S]；values: [S,d]；返回 [d]
    m = scores.new_tensor(-torch.inf)
    total = scores.new_tensor(0.)
    weighted = values.new_zeros(values.shape[-1])
    for start in range(0, scores.numel(), block_size):
        block = scores[start:start + block_size]
        block_values = values[start:start + block_size]
        new_m = torch.maximum(m, block.max())
        correction = torch.exp(m - new_m)
        exponentials = torch.exp(block - new_m)
        weighted = weighted * correction + exponentials @ block_values
        total = total * correction + exponentials.sum()
        m = new_m
    return weighted / total

s = torch.tensor([0., math.log(2)])
values = torch.tensor([[10.], [20.]])
expected = s.softmax(-1) @ values
assert torch.allclose(online_attention(s, values, 1), expected)
# 用多个块大小检查，避免只验证一个恰巧简单的例子。
s = torch.randn(11)
values = torch.randn(11, 4)
for block_size in [1, 2, 5, 11]:
    assert torch.allclose(online_attention(s, values, block_size),
                          s.softmax(-1) @ values, atol=1e-6)


# 可运行片段：只调用被选中的专家
class Top1MoE(nn.Module):
    def __init__(self, width=4, expert_count=3):
        super().__init__()
        self.router = nn.Linear(width, expert_count, bias=False)
        self.experts = nn.ModuleList([
            nn.Sequential(nn.Linear(width, 8), nn.ReLU(), nn.Linear(8, width))
            for _ in range(expert_count)
        ])

    def forward(self, x):
        # x: [B,L,D]；将每个 token 独立送入 router
        flat = x.reshape(-1, x.shape[-1])         # [B*L,D]
        probabilities = self.router(flat).softmax(-1)  # [B*L,E]
        chosen = probabilities.argmax(-1)       # [B*L]
        result = torch.zeros_like(flat)
        counts = []
        for index, expert in enumerate(self.experts):
            selected = chosen == index          # [B*L] 布尔标记
            counts.append(selected.sum().item())
            if selected.any():
                output = expert(flat[selected]) # [分给这个专家的数量,D]
                weight = probabilities[selected, index, None]  # [数量,1]
                result[selected] = output * weight
        return result.reshape_as(x), counts

moe = Top1MoE()
x_moe = torch.randn(2, 3, 4)
y_moe, counts = moe(x_moe)
assert y_moe.shape == x_moe.shape and sum(counts) == 6
y_moe.square().sum().backward()
assert moe.router.weight.grad.abs().sum().item() > 0

print("正文数字实验全部通过。")
