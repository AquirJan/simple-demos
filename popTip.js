// author liangqj3 aquirjan@icloud.com
class popTip {
  constructor(options={}) {
    this.options = Object.assign({
      style: {},
      placement: 'top',
      content: 'hello pop tip',
      popId: 'popTip',
      offset: 0,
      targetEl: document.body,
      animateDuration: 300,
      delay: 0
    }, options);
    if(this.options.animateDuration.constructor !== Number) {
      this.options.animateDuration = 300;
    }
    this.popEl = null;
    this.init()
    setTimeout(()=>{
      this.show()
    }, this.options.delay)
    
    return this;
  }

  init() {
    this.popEl = document.createElement('div')
    
    this.popEl.id = this.options.popId;
    
    let popElDefaultStyle = {
      'position':'absolute',
      'background-color': 'rgba(38,38,38,0.9)',
      'opacity': 0,
      'color': '#fff',
      'border-radius':'4px',
      'box-shadow': '0 2px 8px 0 rgba(0,0,0,0.15)',
      'display': 'flex',
      'transition': `all ${this.options.animateDuration}ms`
    }
    if (this.options.style.constructor === Object) {
      popElDefaultStyle = Object.assign(popElDefaultStyle, this.options.style)
    } else {
      console.warn('style must be an object type')
    }
    const _style = JSON.stringify(popElDefaultStyle).replace(/"*,"/gi, ";").replace(/({)|(})|(")/gi, "");
    this.popEl.style.cssText = _style
    const _older = document.getElementById(this.popEl.id)
    if (_older) {
      _older.style.opacity = 0
      setTimeout(() => {
        _older.remove()
      }, this.options.animateDuration)
    }
    const sharp = this.appendSharp()
    this.appendContent()
    document.body.appendChild(this.popEl)
    const _targetRect = this.options.targetEl.getBoundingClientRect()
    
    const _popElRect = this.popEl.getBoundingClientRect()
    switch(this.options.placement) {
      case 'top':
        this.popEl.style.top = `${_targetRect.y-_popElRect.height - 6 - this.options.offset + window.scrollY}px`
        this.popEl.style.left = `${Math.floor(_targetRect.x-(_popElRect.width-_targetRect.width)/2)}px`
        sharp.style.transform = `translate(${Math.floor(_popElRect.width/2)-6}px, ${_popElRect.height}px)`
        break;
      case 'bottom':
        this.popEl.style.top = `${_targetRect.bottom + 6 + this.options.offset + window.scrollY}px`
        this.popEl.style.left = `${Math.floor(_targetRect.x-(_popElRect.width-_targetRect.width)/2)}px`
        sharp.style.transform = `translate(${_popElRect.width/2-6}px, -12px) rotate(180deg)`
        break;
      case 'left':
        this.popEl.style.top = `${_targetRect.top + (_targetRect.height-_popElRect.height)/2 + window.scrollY}px`
        this.popEl.style.left = `${_targetRect.x - _popElRect.width - 6 - this.options.offset}px`
        sharp.style.transform = `translate(${_popElRect.width}px, ${Math.ceil(_popElRect.height/2)-6}px) rotate(-90deg)`
        break;
      case 'right':
        this.popEl.style.top = `${_targetRect.top + (_targetRect.height-_popElRect.height)/2 + window.scrollY}px`
        this.popEl.style.left = `${_targetRect.left + _targetRect.width + 6 + this.options.offset}px`
        sharp.style.transform = `translate(-12px, ${Math.ceil(_popElRect.height/2)-6}px) rotate(90deg)`
        break;
    }
    
    return this;
  }
  appendSharp() {
    const sharp = document.createElement('div')
    sharp.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    border-width: 6px;
    border-style: solid;
    border-color: rgba(38, 38, 38, 0.9) transparent transparent;
    border-image: initial;`;
    this.popEl.appendChild(sharp)
    return sharp;
  }
  appendContent() {
    let contentEls = null;
    if (this.options.content.constructor === String) {
      contentEls = document.createElement('div');
      contentEls.style.cssText = `padding: 8px 10px;`
      contentEls.innerText = this.options.content;
    } else {
      contentEls = this.options.content;
    }
    if (contentEls) {
      this.popEl.appendChild(contentEls);
    }
  }
  destroy() {
    this.popEl.style.opacity = 0;
    setTimeout(() => {
      this.popEl.remove()
    }, this.options.animateDuration)
  }
  show() {
    if (this.popEl) {
      this.popEl.style.opacity = 1;
    }
  }
}