(function($){
  var docEl = document.documentElement;

  var applyMode = function(mode){
    var isDark = false;
    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'auto') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    docEl.classList.toggle('theme-dark', isDark);
    docEl.classList.toggle('theme-light', !isDark);
    docEl.setAttribute('data-user-mode', mode);
  };

  var initialMode = localStorage.getItem('blog-color-mode') || docEl.getAttribute('data-mode') || 'auto';
  applyMode(initialMode);

  $('#color-mode-toggle').on('click', function(){
    var current = docEl.getAttribute('data-user-mode') || 'auto';
    var next = current === 'light' ? 'dark' : (current === 'dark' ? 'auto' : 'light');
    localStorage.setItem('blog-color-mode', next);
    applyMode(next);
  });

  var updateReadingProgress = function(){
    var scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    var scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0;
    $('#reading-progress').css('width', progress + '%');
  };

  $(window).on('scroll resize', updateReadingProgress);
  updateReadingProgress();

  // Search
  var $searchWrap = $('#search-form-wrap'),
    isSearchAnim = false,
    searchAnimDuration = 200;

  var startSearchAnim = function(){
    isSearchAnim = true;
  };

  var stopSearchAnim = function(callback){
    setTimeout(function(){
      isSearchAnim = false;
      callback && callback();
    }, searchAnimDuration);
  };

  $('.nav-search-btn').on('click', function(){
    if (isSearchAnim) return;

    startSearchAnim();
    $searchWrap.addClass('on');
    stopSearchAnim(function(){
      $('.search-form-input').focus();
    });
  });

  $('.search-form-input').on('blur', function(){
    startSearchAnim();
    $searchWrap.removeClass('on');
    stopSearchAnim();
  });

  // Share
  $('body').on('click', function(){
    $('.article-share-box.on').removeClass('on');
  }).on('click', '.article-share-link', function(e){
    e.stopPropagation();

    var $this = $(this),
      url = $this.attr('data-url'),
      encodedUrl = encodeURIComponent(url),
      id = 'article-share-box-' + $this.attr('data-id'),
      title = $this.attr('data-title'),
      offset = $this.offset();

    if ($('#' + id).length){
      var box = $('#' + id);

      if (box.hasClass('on')){
        box.removeClass('on');
        return;
      }
    } else {
      var html = [
        '<div id="' + id + '" class="article-share-box">',
          '<input class="article-share-input" value="' + url + '">',
          '<div class="article-share-links">',
            '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodedUrl + '" class="article-share-twitter" target="_blank" title="Twitter"><span class="fa fa-twitter"></span></a>',
            '<a href="https://www.facebook.com/sharer.php?u=' + encodedUrl + '" class="article-share-facebook" target="_blank" title="Facebook"><span class="fa fa-facebook"></span></a>',
            '<a href="http://pinterest.com/pin/create/button/?url=' + encodedUrl + '" class="article-share-pinterest" target="_blank" title="Pinterest"><span class="fa fa-pinterest"></span></a>',
            '<a href="https://www.linkedin.com/shareArticle?mini=true&url=' + encodedUrl + '" class="article-share-linkedin" target="_blank" title="LinkedIn"><span class="fa fa-linkedin"></span></a>',
          '</div>',
        '</div>'
      ].join('');

      var box = $(html);

      $('body').append(box);
    }

    $('.article-share-box.on').hide();

    box.css({
      top: offset.top + 25,
      left: offset.left
    }).addClass('on');
  }).on('click', '.article-share-box', function(e){
    e.stopPropagation();
  }).on('click', '.article-share-box-input', function(){
    $(this).select();
  }).on('click', '.article-share-box-link', function(e){
    e.preventDefault();
    e.stopPropagation();

    window.open(this.href, 'article-share-box-window-' + Date.now(), 'width=500,height=450');
  });

  // Caption
  $('.article-entry').each(function(i){
    $(this).find('img').each(function(){
      if ($(this).parent().hasClass('fancybox') || $(this).parent().is('a')) return;

      var alt = this.alt;

      if (alt) $(this).after('<span class="caption">' + alt + '</span>');

      $(this).wrap('<a href="' + this.src + '" data-fancybox=\"gallery\" data-caption="' + alt + '"></a>')
    });

    $(this).find('.fancybox').each(function(){
      $(this).attr('rel', 'article' + i);
    });
  });

  if ($.fancybox){
    $('.fancybox').fancybox();
  }

  // TOC scroll spy
  var tocLinks = $('.post-toc a');
  var headingMap = [];
  if (tocLinks.length){
    tocLinks.each(function(){
      var id = $(this).attr('href');
      if (!id || id.charAt(0) !== '#') return;
      var $heading = $(id);
      if ($heading.length){
        headingMap.push({
          top: $heading.offset().top,
          link: $(this)
        });
      }
    });

    var refreshHeadingState = function(){
      var scrollTop = $(window).scrollTop() + 100;
      var active = null;
      for (var i = 0; i < headingMap.length; i++) {
        if (scrollTop >= headingMap[i].top) active = headingMap[i].link;
      }
      tocLinks.removeClass('is-active');
      if (active) active.addClass('is-active');
    };

    $(window).on('scroll resize', function(){
      headingMap.forEach(function(item){
        var href = item.link.attr('href');
        if (href && href.charAt(0) === '#') {
            var target = $(href);
            if (target.length){
              item.top = target.offset().top;
            }
        }
      });
      refreshHeadingState();
    });

    refreshHeadingState();
  }

  // Local likes
  $('.article-like-btn').each(function(){
    var $btn = $(this);
    var key = $btn.data('like-key');
    if (!key) return;
    var storageKey = 'blog-like-' + key;
    var count = Number(localStorage.getItem(storageKey) || 0);
    if (count > 0) {
      $btn.addClass('is-liked');
      $btn.find('.fa').removeClass('fa-heart-o').addClass('fa-heart');
    }
    $btn.find('.article-like-count').text(count);
  });

  $('body').on('click', '.article-like-btn', function(){
    var $btn = $(this);
    var key = $btn.data('like-key');
    if (!key) return;
    var storageKey = 'blog-like-' + key;
    var count = Number(localStorage.getItem(storageKey) || 0);
    var liked = $btn.hasClass('is-liked');
    if (liked) {
      count = Math.max(0, count - 1);
      $btn.removeClass('is-liked');
      $btn.find('.fa').removeClass('fa-heart').addClass('fa-heart-o');
    } else {
      count += 1;
      $btn.addClass('is-liked');
      $btn.find('.fa').removeClass('fa-heart-o').addClass('fa-heart');
    }
    localStorage.setItem(storageKey, String(count));
    $btn.find('.article-like-count').text(count);
  });

  // Mobile nav
  var $container = $('#container'),
    isMobileNavAnim = false,
    mobileNavAnimDuration = 200;

  var startMobileNavAnim = function(){
    isMobileNavAnim = true;
  };

  var stopMobileNavAnim = function(){
    setTimeout(function(){
      isMobileNavAnim = false;
    }, mobileNavAnimDuration);
  }

  $('#main-nav-toggle').on('click', function(){
    if (isMobileNavAnim) return;

    startMobileNavAnim();
    $container.toggleClass('mobile-nav-on');
    stopMobileNavAnim();
  });

  $('#wrap').on('click', function(){
    if (isMobileNavAnim || !$container.hasClass('mobile-nav-on')) return;

    $container.removeClass('mobile-nav-on');
  });
})(jQuery);