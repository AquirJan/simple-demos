class sbBoard {
  constructor(options) {
    this.options = Object.assign({
      width: window.innerWidth,
      height: window.innerHeight,
      style: {},
      wrapStyle: {},
      drawHistory: [],
      pencilStyle: {
        strokeStyle: '#333',
        lineWidth: 2
      }
    }, options);
    this.sbCtx = null;
    this.sbDom = null;
    this.sbWrap = null;
    this.pencilPressing = false; // 是否画笔按压状态
    this.tinkerUp = null; // 是否处于调整尺寸状态
    this.clickTimeLogs = [];
    this.DragOffset = {
      x: 0,
      y: 0
    }
    this.tmpRect = null;
    this.bgObj = null;
    this.pencilPosition = null;
    this.btnScaleStep = 0.4;
    this.drawType = 'pointer'; // rect, line, polygon
    this.tmpPolygon = null // 存放临时 polygon 对象用
    this.zoomSize = 1;
    this.originDraws = []
    this.controlDotsPath = []
    this.selectedDraw = null;
    this.spaceBar = false;
    return this.init()
  }
  // 初始化
  init() {
    this.sbWrap = document.createElement('div');
    this.sbDom = document.createElement('canvas')
    this.sbDom.width = this.options.width
    this.sbDom.height = this.options.height
    let wrapDefaultStyle = {
      'user-select': 'none',
      'width': this.options.width+'px',
      'height': this.options.height+'px',
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center'
    }
    let canvasDefaultStyle = {
      'user-select': 'none',
      'overflow': 'auto'
    }
    if (this.options.wrapStyle.constructor === Object) {
      wrapDefaultStyle = Object.assign(wrapDefaultStyle, this.options.wrapStyle)
    } else {
      console.warn('wrapStyle must be an object type')
    }
    if (this.options.style.constructor === Object) {
      canvasDefaultStyle = Object.assign(canvasDefaultStyle, this.options.style)
    } else {
      console.warn('style must be an object type')
    }
    this.sbDom.style.cssText = JSON.stringify(canvasDefaultStyle).replace(/"*,"/gi, ";").replace(/({)|(})|(")/gi, "");
    this.sbWrap.style.cssText = JSON.stringify(wrapDefaultStyle).replace(/"*,"/gi, ";").replace(/({)|(})|(")/gi, "");
    this.sbCtx = this.sbDom.getContext('2d')
    this.sbWrap.appendChild(this.sbDom)
    
    this.setDrawsData(this.options.drawHistory)

    this.sbDom.addEventListener('mousedown', (e)=>this.pencilDown(e), false)
    this.sbDom.addEventListener('mousemove', (e)=>this.pencilMove(e), false)
    this.sbDom.addEventListener('mouseup', (e)=>this.pencilUp(e), false)
    document.body.addEventListener('keydown', (e)=>this.sbDomKeydown(e), false)
    document.body.addEventListener('keyup', (e)=>this.sbDomKeyup(e), false)
    this.sbDom.addEventListener('wheel', (e)=>this.sbDomWheel(e), false)

    this.renderBoard()
    return this;
  }
  // 销毁
  destroy() {
    this.sbWrap.remove()
  }
  // 获取画布dom
  getCanavasDom() {
    return this.sbDom;
  }
  // 获取容器dom
  getWrapDom() {
    return this.sbWrap;
  }
  // 获取画布ctx对象
  getCanavasCtx() {
    return this.sbCtx;
  }
  // 设置背景图
  async setBackground(obj) {
    const _obj = Object.assign({
      color: '#878',
      src: ''
    }, obj)
    if (_obj.src) {
      this.bgObj = await this.asyncLoadImage(_obj.src)
      if (this.bgObj.success) {
        this.zoomSize = this.bgObj.scaled;
        this.sbDom.width = this.bgObj.viewWidth
        this.sbDom.height = this.bgObj.viewHeight
      }
    } else {
      this.sbCtx.fillStyle = _obj.color
      this.zoomSize = 1;
    }
  }
  // 加载图promise
  asyncLoadImage(src) {
    return new Promise((resolve) => {
      if (!src) {
        resolve({
          success: false,
          msg: 'no src'
        })
      }
      const image = new Image();
      image.src = src;
      image.onload = () => {
        const { height, width, scaled } = this.calcImageSize(image.naturalWidth, image.naturalHeight)
        resolve({
          success: true,
          msg: 'load image complite',
          data: image,
          scaled: scaled,
          viewWidth: width,
          viewHeight: height,
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }
      image.onerror = () => {
        resolve({
          success: false,
          msg: 'load image error'
        })
      }
    })
  }
  // 绘画背景图
  async drawBackgroundImage(offsetX=0, offsetY=0) {
    if (this.bgObj) {
      this.sbCtx.drawImage(this.bgObj.data, offsetX, offsetY, Math.round(this.bgObj.width*this.zoomSize), Math.round(this.bgObj.height*this.zoomSize))
    }
  }
  // 工具栏用方法
  // 清除
  clearWhole(publicUse = true) {
    if (publicUse) {
      this.originDraws = []
      this.selectedDraw = null;
      this.bgObj = null;
    }
    this.sbCtx.fillStyle = '#fff'
    this.sbCtx.fillRect(-this.sbDom.width*0.1, -this.sbDom.height*0.1, this.sbDom.width*1.1, this.sbDom.height*1.1)
  }
  normalFloat(floatNumber=0, fixed=0) {
    return parseFloat(floatNumber.toFixed(fixed))
  }
  calcCurrentZoomSize(size, plusMinus=true, step=0.010, min=0.2, max=1) {
    if (isNaN(size)) {
      console.warn('size param is not a number')
      return null;
    }
    size = plusMinus ? size + step : size - step
    return Math.max(min, Math.min(parseFloat(size.toFixed(3)), max));
  }
  // 还原缩放
  zoomReset() {
    this.zoomSize = this.bgObj.scaled;
  }
  // 放大
  zoomIn(step=0.05) {
    this.zoomSize = this.calcCurrentZoomSize(this.zoomSize, true, step)
  }
  // 缩小
  zoomOut(step=0.05) {
    this.zoomSize = this.calcCurrentZoomSize(this.zoomSize, false, step)
  }
  // 工具栏用方法end
  // 设置画图类型
  setDrawType(params, publicUse=true) {
    if (publicUse) {
      this.selectedDraw = null;
    }
    this.drawType = params;
  }
  // 设定画笔点击坐标
  setPencilPosition(x, y) {
    this.pencilPosition = {
      x,
      y
    }
  }
  // 获取框框数据
  getDrawsData() {
    return this.originDraws
  }
  // 获取起点与终点之间的尺寸
  getDeltaSize(x, y) {
    return {
      width : x - this.pencilPosition.x, 
      height: y - this.pencilPosition.y 
    }
  }
  // 生成调整控点
  generateAdjustmentDot(x, y, origin=false) {
    const circle = new Path2D();
    const _x = origin ? x : this.normalFloat(x*this.zoomSize)
    const _y = origin ? y : this.normalFloat(y*this.zoomSize)
    circle.arc(
      _x,
      _y,
      6, 
      0, 
      2*Math.PI
    );
    return circle;
  }
  // 调整框框插件
  adjustmentAddon() {
    if (!this.selectedDraw) {
      return;
    }
    const item = this.originDraws[this.selectedDraw.index];
    this.controlDotsPath = [
      {
        originPath: this.generateAdjustmentDot(item.x, item.y, true),
        path: this.generateAdjustmentDot(item.x, item.y), 
        cursor: 'nwse-resize',
        code: 'tl',
      },
      {
        originPath: this.generateAdjustmentDot(item.x+item.width/2, item.y, true),
        path: this.generateAdjustmentDot(item.x+item.width/2, item.y),
        cursor: 'ns-resize',
        code: 'tm',
      },
      {
        originPath: this.generateAdjustmentDot(item.x+item.width, item.y, true),
        path: this.generateAdjustmentDot(item.x+item.width, item.y),
        cursor: 'nesw-resize',
        code: 'tr',
      },
      {
        originPath: this.generateAdjustmentDot(item.x+item.width, item.y+item.height/2, true),
        path: this.generateAdjustmentDot(item.x+item.width, item.y+item.height/2),
        cursor: 'ew-resize',
        code: 'rm',
      },
      {
        originPath: this.generateAdjustmentDot(item.x+item.width, item.y+item.height, true),
        path: this.generateAdjustmentDot(item.x+item.width, item.y+item.height),
        cursor: 'nwse-resize',
        code: 'br',
      },
      {
        originPath: this.generateAdjustmentDot(item.x+item.width/2, item.y+item.height, true),
        path: this.generateAdjustmentDot(item.x+item.width/2, item.y+item.height),
        cursor: 'ns-resize',
        code: 'bm',
      },
      {
        originPath: this.generateAdjustmentDot(item.x, item.y+item.height, true),
        path: this.generateAdjustmentDot(item.x, item.y+item.height),
        cursor: 'nesw-resize',
        code: 'bl',
      },
      {
        originPath: this.generateAdjustmentDot(item.x, item.y+item.height/2, true),
        path: this.generateAdjustmentDot(item.x, item.y+item.height/2),
        cursor: 'ew-resize',
        code: 'lm',
      }
    ]
    this.sbCtx.fillStyle = '#2ac2e4';
    this.controlDotsPath.forEach(val => {
      this.sbCtx.fill(val.path);
    })
  }
  initPencilStyle() {
    this.sbCtx.strokeStyle = this.options.pencilStyle.strokeStyle
    this.sbCtx.lineWidth = this.options.pencilStyle.lineWidth
  }
  setDrawsData(data) {
    this.originDraws = data 
  }
  reinitDragOffset() {
    if (this.DragOffset.x!==0) {
      const _reinitX = setInterval(()=>{
        if (this.DragOffset.x <=0 ) {
          this.DragOffset.x = 0
          window.clearInterval(_reinitX)
        }
        this.DragOffset.x = this.DragOffset.x - 10
      }, 30)
    }
    if (this.DragOffset.y!==0) {
      const _reinitY = setInterval(()=>{
        if (this.DragOffset.y <=0 ) {
          this.DragOffset.y = 0
          window.clearInterval(_reinitY)
        }
        this.DragOffset.y = this.DragOffset.y - 10
      }, 30)
    }
  }
  // 绘制画面
  renderBoard() {
    this.clearWhole(false)
    // 设置背景图
    // if (!this.spaceBar) {
    //   this.reinitDragOffset()
    // }
    
    this.drawBackgroundImage(this.DragOffset.x, this.DragOffset.y)
    // console.log(this.originDraws)
    this.initPencilStyle()
    this.originDraws.forEach(val => {
      switch (val.type) {
        case 'rect':
          this.sbCtx.strokeRect(
            this.normalFloat(val.x*this.zoomSize)+this.DragOffset.x,
            this.normalFloat(val.y*this.zoomSize)+this.DragOffset.y,
            this.normalFloat(val.width*this.zoomSize),
            this.normalFloat(val.height*this.zoomSize)
          );
          break;
        default:
      }
    })
    // 临时矩形
    if (this.tmpRect) {
      this.sbCtx.stroke(this.tmpRect)
    }
    this.adjustmentAddon()
    window.requestAnimationFrame(()=>this.renderBoard())
    
  }
  sbDomWheel(e) {
    const _wheelDelta = e.wheelDelta;
    if (e.ctrlKey && Math.abs(_wheelDelta) > 0) {
      if (_wheelDelta > 0) {
        this.zoomIn(0.010)
      } else {
        this.zoomOut(0.010)
      }
    }
    e.preventDefault()
    e.stopPropagation()
  }
  deleteSelectedDraw() {
    if (this.selectedDraw) {
      this.originDraws.splice(this.selectedDraw.index, 1)
      this.selectedDraw = null;
    }
  }
  sbDomKeyup(e) {
    const keycode = e.keyCode;
    if (keycode === 32){
      // 空格
      this.spaceBar = false;
      e.preventDefault()
      e.stopPropagation()
      return;
    }
  }
  sbDomKeydown(e) {
    const keycode = e.keyCode;
    // console.log(keycode)
    if (keycode === 32){
      // 空格
      this.spaceBar = true;
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if (this.selectedDraw) {
      const _item = this.originDraws[this.selectedDraw.index]
      switch(keycode) {
        case 8:
        case 46:
          this.deleteSelectedDraw()
          break;
        // case 17:
        //   e.preventDefault()
        //   e.stopPropagation()
        //   break;
        case 37:
          // 左
          _item['x'] = _item.x - this.normalFloat(1/this.zoomSize)
          this.selectedDraw['data'] = JSON.parse(JSON.stringify(_item))
          break;
        case 39:
          // 右
          _item['x'] = _item.x + this.normalFloat(1/this.zoomSize)
          this.selectedDraw['data'] = JSON.parse(JSON.stringify(_item))
          break;
        case 38:
          // 上
          _item['y'] = _item.y - this.normalFloat(1/this.zoomSize)
          this.selectedDraw['data'] = JSON.parse(JSON.stringify(_item))
          break;
        case 40:
          // 下
          _item['y'] = _item.y + this.normalFloat(1/this.zoomSize)
          this.selectedDraw['data'] = JSON.parse(JSON.stringify(_item))
          break;
      }
    }
    
  }
  // 画笔下笔事件方法
  pencilDown(e) {
    if (this.spaceBar) {
      this.selectedDraw = null;
      this.pencilPressing = true;
      this.DragOffset['x'] = e.offsetX-this.DragOffset.x
      this.DragOffset['y'] = e.offsetY-this.DragOffset.y
      return;
    }
    const pointX = this.normalFloat(e.offsetX/this.zoomSize)
    const pointY = this.normalFloat(e.offsetY/this.zoomSize)
    switch (this.drawType) {
      case "pointer":
        
        if (this.selectedDraw) {
          const _item = JSON.parse(JSON.stringify(this.calcIsOnDrawPath(pointX, pointY)))
          if (_item && this.selectedDraw.data.id !== _item.data.id) {
            this.selectedDraw = _item
          }
          for(let i=0;i<this.controlDotsPath.length;i++) {
            if (this.sbCtx.isPointInPath(this.controlDotsPath[i].originPath, pointX, pointY)) {
              document.body.style.cursor = this.controlDotsPath[i].cursor;
              this.tinkerUp = this.controlDotsPath[i].code;
              break;
            }
          }
        } else {
          this.selectedDraw = JSON.parse(JSON.stringify(this.calcIsOnDrawPath(pointX, pointY)))
        }
        if (this.selectedDraw && !this.calcIsInsideDraw(pointX, pointY) && !this.tinkerUp && !this.calcIsOnDrawPath(pointX, pointY)) {
          this.selectedDraw = null;
        }
        
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(pointX, pointY)
        break;
      case "rect":
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(pointX, pointY)
        break;
    }
  }
  // 画笔移动事件方法
  pencilMove(e) {
    if (this.spaceBar && this.pencilPressing) {
      this.DragOffset['x'] = e.offsetX-this.DragOffset.x
      this.DragOffset['y'] = e.offsetY-this.DragOffset.y
      return;
    }
    const pointX = this.normalFloat(e.offsetX/this.zoomSize)
    const pointY = this.normalFloat(e.offsetY/this.zoomSize)
    switch (this.drawType) {
      case "pointer":
        if (!this.pencilPressing) {
          if (!this.pencilPosition) {
            document.body.style.cursor = this.calcIsOnDrawPath(pointX, pointY) || this.calcIsInsideDraw(pointX, pointY) ? 'move' : 'default'
            if (this.selectedDraw) {
              for(let i=0;i<this.controlDotsPath.length;i++) {
                if (this.sbCtx.isPointInPath(this.controlDotsPath[i].originPath, pointX, pointY)) {
                  document.body.style.cursor = this.controlDotsPath[i].cursor;
                  break;
                }
              }
            }
          }
        } else {
          if (this.selectedDraw) {
            if (this.tinkerUp) {
              // console.log('调整尺寸')
              // 调整尺寸
              const _sditem = this.selectedDraw.data;
              const _ds = this.getDeltaSize(pointX, pointY)
              let _item = this.originDraws[this.selectedDraw.index];
              switch(this.tinkerUp) {
                case "bm":
                  _item.height = _sditem.height + _ds.height
                  _item.dy = _sditem.dy + _ds.height
                  break;
                case "rm":
                  _item.width = _sditem.width + _ds.width
                  _item.dx = _sditem.dx + _ds.width
                  break;
                case "br":
                  _item.height = _sditem.height + _ds.height
                  _item.dy = _sditem.dy + _ds.height
                  _item.width = _sditem.width + _ds.width
                  _item.dx = _sditem.dx + _ds.width
                  break;
                case "tm":
                  _item.height = _sditem.height - _ds.height
                  _item.y = _sditem.y + _ds.height
                  break;
                case "lm":
                  _item.width = _sditem.width - _ds.width
                  _item.x = _sditem.x + _ds.width
                  break;
                case "tl":
                  _item.height = _sditem.height - _ds.height
                  _item.y = _sditem.y + _ds.height
                  _item.width = _sditem.width - _ds.width
                  _item.x = _sditem.x + _ds.width
                  break;
                case "tr":
                  _item.width = _sditem.width + _ds.width
                  _item.dx = _sditem.dx + _ds.width
                  _item.height = _sditem.height - _ds.height
                  _item.y = _sditem.y + _ds.height
                  break;
                case "bl":
                  _item.height = _sditem.height + _ds.height
                  _item.dy = _sditem.dy + _ds.height
                  _item.width = _sditem.width - _ds.width
                  _item.x = _sditem.x + _ds.width
                  break;
              }
            } else {
              // 整体移动
              const _sditem = this.selectedDraw.data;
              const _ds = this.getDeltaSize(pointX, pointY)
              let _item = this.originDraws[this.selectedDraw.index];
              _item.x = _sditem.x + _ds.width
              _item.y = _sditem.y + _ds.height
              _item.dx = _sditem.dx + _ds.width
              _item.dy = _sditem.dy + _ds.height
            }
          }
        }
        
        break;
      case 'rect':
        if (!this.pencilPressing) {
          return;
        }
        this.drawRect(pointX, pointY)
        break;
    }
  }
  // 画笔收笔方法
  pencilUp(e) {
    if (this.pencilPressing) {
      this.DragOffset['x'] = e.offsetX-this.DragOffset.x
      this.DragOffset['y'] = e.offsetY-this.DragOffset.y

      this.pencilPressing = false;
      return;
    }
    const pointX = this.normalFloat(e.offsetX/this.zoomSize)
    const pointY = this.normalFloat(e.offsetY/this.zoomSize)
    switch (this.drawType) {
      case "pointer":
        if (this.pencilPressing) {
          if (this.selectedDraw) {
            const _item = this.originDraws[this.selectedDraw.index];
            // 修正翻转调整后的坐标错误偏差
            switch(this.tinkerUp) {
              case "tm":
              case "bm":
                if (_item.height < 0) {
                  [_item.y, _item.dy] = [_item.dy, _item.y]; // es6 对调两个值
                  _item.height = Math.abs(_item.height)
                }
                break;
              case "lm":
              case "rm":
                if (_item.width < 0) {
                  [_item.x, _item.dx] = [_item.dx, _item.x]; // es6 对调两个值
                  _item.width = Math.abs(_item.width)
                }
                break;
              case "tr":
              case "bl":
              case "tl":
              case "br":
                if (_item.width < 0) {
                  [_item.x, _item.dx] = [_item.dx, _item.x]; // es6 对调两个值
                  _item.width = Math.abs(_item.width)
                }
                if (_item.height < 0) {
                  [_item.y, _item.dy] = [_item.dy, _item.y]; // es6 对调两个值
                  _item.height = Math.abs(_item.height)
                }
                break;
            }
            this.selectedDraw.data = JSON.parse(JSON.stringify(_item));
          }
          this.pencilPressing = false;
          this.tinkerUp = null;
        }
        
        this.pencilPosition = null;
        
        break;
      case "rect":
        
        this.pencilPressing = false;
        let someOneRect = this.drawRect(pointX, pointY)
        
        someOneRect['width'] = Math.abs(someOneRect.width)
        someOneRect['height'] = Math.abs(someOneRect.height)
        if (someOneRect.x > someOneRect.dx) {
          [someOneRect.x, someOneRect.dx] = [someOneRect.dx, someOneRect.x]; // es6 对调两个值
        }
        if (someOneRect.y > someOneRect.dy) {
          [someOneRect.y, someOneRect.dy] = [someOneRect.dy, someOneRect.x]; // es6 对调两个值
        }

        if (someOneRect.width > 20 || someOneRect.height > 20)  {
          // 记录已经画的rects
          someOneRect['id'] = this.generateUUID()
          // someOneRect['selected'] = true
          this.originDraws.push(someOneRect)
          this.tmpRect = null;
          this.selectedDraw = JSON.parse(JSON.stringify({
            data: this.originDraws[this.originDraws.length-1],
            index: (this.originDraws.length-1)
          }))
        } else {
          this.tmpRect = null;
        }
        this.setDrawType('pointer', false)
        this.pencilPosition = null;
        break;
    }
    
  }
  // 计算画笔是否在某个画图上
  calcIsOnDrawPath(x, y) {
    let _flag = null;
    for(let i=0;i<this.originDraws.length;i++) {
      const _item = this.originDraws[i];
      switch(_item.type) {
        case "rect":
          const _tmpRect = new Path2D()
          _tmpRect.rect(
            _item.x,
            _item.y,
            _item.width,
            _item.height
          )
          if(this.sbCtx.isPointInStroke(_tmpRect, x, y)){
            // _item['selected'] = true;
            _flag = {
              data: _item,
              index: i
            }
          }
          break;
      }
      if (_flag) {
        break;
      }
    }
    return _flag;
  }
  // 计算画笔是否在已选中的画图上
  calcIsInsideDraw(x, y) {
    let _final = false;
    if (this.selectedDraw) {
      const _item = this.selectedDraw.data;
      switch(_item.type) {
        case "rect":
          const _tmpRect = new Path2D()
          _tmpRect.rect(
            _item.x,
            _item.y,
            _item.width,
            _item.height
          )
          _final = this.sbCtx.isPointInPath(_tmpRect, x, y)
          break;
      }
    }
    return _final;
  }
  // 计算图片显示宽高
  calcImageSize(width, height) {
    let _obj = {
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
      scaled: 1,
    }
    if (width && height) {
      _obj.width = Math.round(width * (this.sbDom.height/height))
      if (_obj.width > this.sbDom.width) {
        _obj.width = this.sbDom.width
        _obj.height = Math.round(height * (this.sbDom.width/width))
        _obj.offsetX = 0;
        _obj.offsetY = this.normalFloat(((this.sbDom.height - _obj.height)/2))
        _obj.scaled = this.normalFloat((this.sbDom.width/width), 3);
      } else {
        _obj.height = this.sbDom.height
        _obj.offsetY = 0;
        _obj.offsetX = this.normalFloat(((this.sbDom.width - _obj.width)/2))
        _obj.scaled = this.normalFloat((this.sbDom.height/height), 3);
      }
    }
    return _obj
  }
  // 检验是否双击
  detectIsDBClick(ctime) {
    this.clickTimeLogs.unshift(ctime)
    if (this.clickTimeLogs.length > 2) {
      this.clickTimeLogs = this.clickTimeLogs.slice(0, 2)
    }
    if (this.clickTimeLogs.length !== 2) {
      return false;
    }
    const _deltaTime = Math.abs(this.clickTimeLogs[0] - this.clickTimeLogs[1])
    
    if (_deltaTime <= 200) {
      return true;
    } else {
      return false;
    }
  }
  // 产生id
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }
  // 判断两点是否接近 
  detectTwoPointClose(reference, point) {
    let flagX = false;
    let flagY = false;
    if (point.x <= reference.x + 5 && point.x >= reference.x - 5) {
      flagX = true;
    }
    if (point.y <= reference.y + 5 && point.y >= reference.y - 5) {
      flagY = true;
    }
    if (flagX && flagY) {
      return true;
    } else {
      return false;
    }
  }
  // 绘画矩形
  drawRect(cx, cy) {
    const _ds = this.getDeltaSize(cx, cy)
    this.tmpRect = new Path2D()
    this.tmpRect.rect(
      this.pencilPosition.x*this.zoomSize,
      this.pencilPosition.y*this.zoomSize, 
      _ds.width*this.zoomSize, 
      _ds.height*this.zoomSize
    );
    return {
      x: this.pencilPosition.x,
      y: this.pencilPosition.y,
      dx: cx,
      dy: cy,
      width: _ds.width,
      height: _ds.height,
      type: 'rect',
    }
  }
}