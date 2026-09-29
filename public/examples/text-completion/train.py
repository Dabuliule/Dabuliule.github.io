"""用字符与位置向量、多头因果 Attention 做字符续写。

运行：python train.py
训练语料来自 corpus.txt；留出的组合只用于训练结束后的验证。
"""

from pathlib import Path

import torch
from torch import nn
import torch.nn.functional as F


class TransformerBlock(nn.Module):
    def __init__(self):
        super().__init__()
        self.attention_norm = nn.LayerNorm(32)
        self.ffn_norm = nn.LayerNorm(32)
        self.query = nn.Linear(32, 32)
        self.key = nn.Linear(32, 32)
        self.value = nn.Linear(32, 32)
        self.num_heads = 4
        self.head_dim = 8
        self.attention_output = nn.Linear(32, 32)
        self.ffn = nn.Sequential(
            nn.Linear(32, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
        )

    def split_heads(self, vectors):
        batch, length, _ = vectors.shape
        return vectors.reshape(batch, length, self.num_heads, self.head_dim).transpose(1, 2)
        # [B, L, 32] -> [B, 4, L, 8]

    def forward(self, states, cache=None):
        past_len = 0 if cache is None else cache[0].shape[2]
        normalized_states = self.attention_norm(states)
        Q = self.split_heads(self.query(normalized_states))  # [B, 4, L, 8]
        K = self.split_heads(self.key(normalized_states))  # 只投影本次输入：[B, 4, L, 8]
        V = self.split_heads(self.value(normalized_states))
        if cache is not None:
            old_K, old_V = cache
            K = torch.cat([old_K, K], dim=2)  # [B, 4, P+L, 8]
            V = torch.cat([old_V, V], dim=2)
        scores = (Q @ K.transpose(-2, -1)) / (self.head_dim ** 0.5)  # [B, 4, L, P+L]
        # 第 i 个新位置可关注旧历史和新位置 0..i；训练时 P=0。
        future_mask = torch.triu(
            torch.ones(states.shape[1], K.shape[2], dtype=torch.bool, device=states.device),
            diagonal=past_len + 1,
        )
        weights = scores.masked_fill(future_mask, float("-inf")).softmax(dim=-1)
        context = weights @ V  # [B, 4, L, 8]
        context = context.transpose(1, 2).reshape(states.shape[0], states.shape[1], 32)
        context = self.attention_output(context)  # [B, L, 32]，混合四个头的信息
        combined = states + context  # [B, L, 32]，原表示加上 Attention 的更新
        combined = combined + self.ffn(self.ffn_norm(combined))  # Pre-LN：先归一化再计算更新
        return combined, (K, V)


class NextCharModel(nn.Module):
    def __init__(self, vocab_size, num_layers=2):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, 32)
        self.position_embedding = nn.Embedding(64, 32)
        self.layers = nn.ModuleList([TransformerBlock() for _ in range(num_layers)])
        self.final_norm = nn.LayerNorm(32)
        self.output = nn.Linear(32, vocab_size)

    def forward(self, context_ids, caches=None):
        # 每层有自己的 (K, V)；所有层缓存的位置数相同。
        past_len = 0 if caches is None else caches[0][0].shape[2]
        length = context_ids.shape[1]
        if past_len + length > self.position_embedding.num_embeddings:
            raise ValueError("输入及历史总长度超过位置表支持的 64 个位置")
        positions = torch.arange(past_len, past_len + length, device=context_ids.device)
        states = self.embedding(context_ids) + self.position_embedding(positions)
        new_caches = []
        for index, layer in enumerate(self.layers):
            cache = None if caches is None else caches[index]
            states, new_cache = layer(states, cache)  # [B, L, 32] -> [B, L, 32]
            new_caches.append(new_cache)
        return self.output(self.final_norm(states)), new_caches


def make_context(prefix, token_to_id):
    return torch.tensor([[token_to_id[char] for char in prefix]])  # [1, L]


def make_data(sentences, token_to_id):
    batch_size = len(sentences)
    max_len = max(len(sentence) for sentence in sentences)
    inputs = torch.full((batch_size, max_len), token_to_id["<pad>"], dtype=torch.long)
    labels = torch.full((batch_size, max_len), -100, dtype=torch.long)
    for row, sentence in enumerate(sentences):
        length = len(sentence)
        inputs[row, :length] = torch.tensor([token_to_id[char] for char in sentence])
        next_tokens = list(sentence[1:]) + ["<eos>"]
        labels[row, :length] = torch.tensor([token_to_id[token] for token in next_tokens])
    return inputs, labels  # 均为 [B, L]，右侧保留补齐值


def training_loss(model, inputs, labels):
    # 仅右侧补齐：有效位置的因果遮罩挡住所有 pad；pad 位置的 loss 被忽略。
    # 补齐后的历史不用于续写；complete 使用无补齐的单个提示词。
    logits, _ = model(inputs)  # [B, L, V]
    return F.cross_entropy(
        logits.reshape(-1, logits.shape[-1]), labels.reshape(-1),
        ignore_index=-100, reduction="mean",  # 只对有效目标求平均
    )


@torch.no_grad()
def complete(model, prompt, token_to_id, vocab, max_new_chars=12):
    text = prompt
    logits, cache = model(make_context(prompt, token_to_id))  # 提示词只读一次
    for index in range(max_new_chars):
        next_id = logits[0, -1].argmax().item()
        next_char = vocab[next_id]
        if next_char == "<eos>":
            break
        text += next_char
        if index + 1 < max_new_chars:
            logits, cache = model(torch.tensor([[next_id]]), cache)  # 复用旧 K、V
    return text


def main():
    torch.manual_seed(42)
    torch.set_num_threads(1)
    sentences = [line.strip() for line in Path(__file__).with_name("corpus.txt").read_text().splitlines()
                 if line.strip()]
    vocab = ["<eos>"] + sorted(set("".join(sentences))) + ["<pad>"]
    token_to_id = {token: index for index, token in enumerate(vocab)}
    inputs, labels = make_data(sentences, token_to_id)
    model = NextCharModel(len(vocab))
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    for epoch in range(1, 301):
        loss = training_loss(model, inputs, labels)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        if epoch in [1, 50, 300]:
            with torch.no_grad():
                print(f"epoch={epoch:3d}，训练 loss={training_loss(model, inputs, labels).item():.4f}")
    model.eval()
    # 验证句子没有进入词表构造、训练数据或反向传播。
    validation = ["我今天早上喝茶。", "他今天早上喝水。",
                  "我今天早上吃苹果。", "他今天早上吃香蕉。"]
    for name, examples in [("训练句子", sentences), ("留出的组合", validation)]:
        correct = 0
        print(f"\n{name}：")
        for expected in examples:
            # 给出人物、时间和动作，让模型续写宾语与句号。
            action_position = max(expected.find("喝"), expected.find("吃"))
            prompt = expected[:action_position + 1]
            generated = complete(model, prompt, token_to_id, vocab)
            correct += generated == expected
            print(f"{prompt} → {generated[len(prompt):]}（期望：{expected[len(prompt):]}）")
        print(f"完整续写匹配：{correct}/{len(examples)}")


if __name__ == "__main__":
    main()
