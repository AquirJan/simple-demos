export default class sbBoard {
  constructor(options) {
    this.options = Object.assign({
      width: window.innerWidth,
      height: window.innerHeight,
      style: {},
      wrapStyle: {},
      drawHistory: [],
      pencilStyle: {
        strokeStyle: '#333',
        lineWidth: 2,
        brushSize: 50,
        brushColor: 'blue',
      },
      eraserSize: 10
    }, options);
    this.sbCtx = null;
    this.sbDom = null;
    this.sbWrap = null;
    this.pencilPressing = false; // 是否画笔按压状态
    this.tinkerUp = null; // 是否处于调整尺寸状态
    this.clickTimeLogs = [];
    this.dragOffset = {
      x: 0,
      y: 0
    }
    this.dragDownPoint = {
      x: 0,
      y: 0
    }
    this.isObserver = false; // 是否观察者模式
    this.tmpRect = null;
    this.bgObj = null;
    this.existBrushObj = null;
    this.pencilPosition = null;
    this.btnScaleStep = 0.4;
    this.drawType = 'pointer'; // rect, polygon, brush, eraser
    this.tmpPolygon = null // 存放临时 polygon 对象用
    this.zoomSize = 1;
    this.oldZoomSize = 1
    this.originDraws = []
    this.controlDots = []
    this.selectedDraw = null;
    this.spaceBar = false;
    this.shiftKey = false;
    this.ctrlKey = false;
    this.altKey = false;
    this.draging = false;
    this.hoverPoint = {
      x: 0,
      y: 0,
    }
    this.modifyRect = null;
    this.tmpPath2d = null;
    this.hoverDraw = null;

    this.pencilDownFn = null;
    this.pencilMoveFn = null;
    this.pencilUpFn = null;
    this.pencilDom = null;
    this.prevCursor = '';
    this.rightPressing = null;
    this.hiddenDraws = false;
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
    this.setDrawType('pointer')
    
    document.body.addEventListener('keydown', (e)=>this.sbDomKeydown(e), false)
    document.body.addEventListener('keyup', (e)=>this.sbDomKeyup(e), false)
    this.sbDom.addEventListener('wheel', (e)=>this.sbDomWheel(e), false)
    this.sbDom.oncontextmenu = (e)=>{
      e.preventDefault()
    }

    this.renderBoard()
    return this;
  }
  // 销毁
  destroy() {
    this.sbWrap.remove()
  }
  // 获取当前选中框框
  getSelectedDraw(){
    return this.selectedDraw
  }
  // 获取画布dom
  getCanvasDom() {
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
  // 设置观察者模式, 鼠标hover会单独显示所选draw
  setObserverMode(isObserver=true){
    this.selectedDraw = null;
    this.isObserver = isObserver
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
        this.dragOffset = {
          x: this.bgObj.offsetX,
          y: this.bgObj.offsetY,
        }
        // this.sbDom.width = this.bgObj.viewWidth
        // this.sbDom.height = this.bgObj.viewHeight
      }
    } else {
      this.sbCtx.fillStyle = _obj.fillStyle
      this.zoomSize = 1;
    }
  }
  // 设置背景图
  async setExistBrush(obj) {
    const _obj = Object.assign({
      color: '#878',
      src: ''
    }, obj)
    if (_obj.src) {
      this.existBrushObj = await this.asyncLoadImage(_obj.src)
    }
  }
  // 找出4个极点
  findOut4Poles(selectedDraws, isOrigin=false) {
    let _drawers = []
    if (selectedDraws.constructor === Array){
      _drawers = selectedDraws;
    } else if (selectedDraws.constructor === Object) {
      _drawers = [selectedDraws]
    }
    let _x_coordinate = [];
    let _y_coordinate = [];
    
    _drawers.forEach(val => {
      const _item = isOrigin ? val : val.data;
      _x_coordinate.push(_item.x)
      _y_coordinate.push(_item.y)
      if (_item.width) {
        _x_coordinate.push(_item.x+_item.width)
      }
      if (_item.height) {
        _y_coordinate.push(_item.y+_item.height)
      }
      if (_item.ways) {
        _item.ways.forEach(wval=>{
          _x_coordinate.push(wval.x)
          _y_coordinate.push(wval.y)
        })
      }
    })
    _x_coordinate.sort((a, b)=>a-b)
    _y_coordinate.sort((a, b)=>a-b)
    const modifyRect = {
      type: 'modifyRect',
      x: _x_coordinate[0],
      y: _y_coordinate[0],
      width: _x_coordinate[_x_coordinate.length-1]-_x_coordinate[0],
      height: _y_coordinate[_y_coordinate.length-1]-_y_coordinate[0]
    }
    return modifyRect
  }
  // 框框外部调整控制器
  drawOutsideAddon(){
    const _selectedIndex = this.selectedDraw.map(val=>val.index);
    let _canAdjust = true;
    let _selectedOrigins = this.originDraws.filter((val, index) => {
      if (_selectedIndex.includes(index)) {
        if (val.type !== 'rect') {
          _canAdjust = false;
        }
        return val
      }
    });
    
    this.modifyRect = this.findOut4Poles(_selectedOrigins, true);
    
    // const _gap = 5/this.zoomSize;
    const _gap = 0;
    const _x = this.modifyRect.x - _gap
    const _y = this.modifyRect.y - _gap
    const _width = this.modifyRect.width + _gap*2
    const _height = this.modifyRect.height + _gap*2
    this.sbCtx.beginPath()
    this.sbCtx.moveTo(_x, _y)
    this.sbCtx.lineTo(_x+_width, _y)
    this.sbCtx.lineTo(_x+_width, _y+_height)
    this.sbCtx.lineTo(_x, _y+_height)
    this.sbCtx.closePath()
    this.sbCtx.setLineDash([20, 12]);
    this.sbCtx.strokeStyle = '#f79262'
    this.sbCtx.stroke()
    this.sbCtx.setLineDash([]);
    // 多draws调整大小
    // if (_canAdjust) {
    //   this.adjustmentAddon(this.modifyRect, _gap)
    // }
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
        const { height, width, scaled, offsetX, offsetY } = this.calcImageSize(image.naturalWidth, image.naturalHeight)
        resolve({
          success: true,
          msg: 'load image complite',
          data: image,
          scaled,
          offsetX, 
          offsetY,
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
  // 工具栏用方法
  // 清除
  clearWhole(publicUse = true) {
    let clearSize ={
      width: this.sbDom.width,
      height: this.sbDom.height
    }
    if (publicUse) {
      this.originDraws = []
      this.selectedDraw = null;
      this.bgObj = null;
    }
    if (this.bgObj) {
      clearSize ={
        width: this.sbDom.width/this.bgObj.scaled,
        height: this.sbDom.height/this.bgObj.scaled
      }
    }
    this.sbCtx.clearRect(-clearSize.width, -clearSize.height, clearSize.width*3, clearSize.height*3)
  }
  // 规范小数
  normalFloat(floatNumber=0, fixed=0) {
    return parseFloat(floatNumber.toFixed(fixed))
  }
  // 计算当前缩放尺寸
  calcCurrentZoomSize(size, plus=true, step=0.010, min=0.15, max=1) {
    if (isNaN(size)) {
      console.warn('size param is not a number')
      return null;
    }
    this.oldZoomSize = size;
    size = plus ? size + step : size - step
    const _min = Math.min(this.bgObj.scaled, 1)
    return Math.max(_min, Math.min(parseFloat(size.toFixed(3)), max));
  }
  // 计算缩放后拖拉后的差值
  calcZoomedDragoffsetDeltaSize(zoomin=true){
    if (!this.bgObj) {
      return;
    }
    const _width = this.bgObj ? this.bgObj.width : this.options.width;
    const _height = this.bgObj ? this.bgObj.height : this.options.height;
    let _deltaWidth = Math.abs(_width*this.zoomSize-_width*this.oldZoomSize)/2
    let _deltaHeight = Math.abs(_height*this.zoomSize-_height*this.oldZoomSize)/2;
    let x = 0;
    let y = 0;
    if (zoomin) {
      x = this.dragOffset.x - _deltaWidth
      y = this.dragOffset.y - _deltaHeight
    } else {
      x = this.dragOffset.x + _deltaWidth
      y = this.dragOffset.y + _deltaHeight
    }
    this.dragOffset = {
      x,
      y
    }
    return this.dragOffset
  }
  // 还原缩放
  zoomReset() {
    this.calcZoomedDragoffsetDeltaSize(false)
    if (this.bgObj) {
      this.dragOffset = {
        x: this.bgObj.offsetX,
        y: this.bgObj.offsetY
      }
    } else {
      this.dragOffset = {
        x: 0,
        y: 0
      }
    }
    this.zoomSize = this.bgObj ? this.bgObj.scaled : 1;
  }
  // 放大
  zoomIn(step=0.05) {
    this.zoomSize = this.calcCurrentZoomSize(this.zoomSize, true, step)
    if (this.oldZoomSize !== this.zoomSize) {
      this.calcZoomedDragoffsetDeltaSize()
    }
  }
  // 缩小
  zoomOut(step=0.05) {
    this.zoomSize = this.calcCurrentZoomSize(this.zoomSize, false, step)
    if (this.oldZoomSize !== this.zoomSize) {
      this.calcZoomedDragoffsetDeltaSize(false)
    }
  }
  getAllDraws(){
    return this.originDraws;
  }
  setDrawLabel(draws, label, strokeStyle){
    if (draws.constructor === Object) {
      this.originDraws[draws.index]['label'] = label;
      this.originDraws[draws.index]['strokeStyle'] = strokeStyle;
    }
    // 神奇的显示隐藏功能
    if (this.hiddenDraws){
      this.selectedDraw = null;
    }
  }
  // 工具栏用方法end
  // 设置画图类型
  setDrawType(params, publicUse=true, options={}) {
    if (publicUse) {
      this.selectedDraw = null;
    }
    this.drawType = params;
    if (this.drawType!=='pointer'){
      document.documentElement.style.cursor = 'crosshair'
    }
    if (this.pencilDownFn) {
      this.sbDom.removeEventListener('mousedown', this.pencilDownFn, false)
      this.pencilDownFn = null;
    }
    if (this.pencilMoveFn) {
      this.sbDom.removeEventListener('mousemove', this.pencilMoveFn, false)
      this.pencilMoveFn = null;
    }
    if (this.pencilUpFn) {
      this.sbDom.removeEventListener('mouseup', this.pencilUpFn, false)
      this.sbDom.removeEventListener('mouseout', this.pencilUpFn, false)
      this.pencilUpFn = null;
    }
    if (this.drawType !== 'pointer' && this.isObserver) {
      return false;
    }
    if (this[`${this.drawType}DownFn`]) {
      this.pencilDownFn = (e)=>this[`${this.drawType}DownFn`](e, options)
      this.sbDom.addEventListener('mousedown', this.pencilDownFn, false)
      this.pencilMoveFn = (e)=>this[`${this.drawType}MoveFn`](e, options)
      this.sbDom.addEventListener('mousemove', this.pencilMoveFn, false)
      this.pencilUpFn = (e)=>this[`${this.drawType}UpFn`](e, options)
      this.sbDom.addEventListener('mouseup', this.pencilUpFn, false)
      this.sbDom.addEventListener('mouseout', this.pencilUpFn, false)
    }
  }
  getPointerPosition(){
    return this.hoverPoint;
  }
  findOutFoucusDraw(){
    this.tinkerUp = null;
    if (this.selectedDraw) {
      // 判断是否单选情况
      if (this.selectedDraw.constructor === Object) {
        const _item = JSON.parse(JSON.stringify(this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)))
        if (_item && this.selectedDraw.index !== _item.index) {
          this.selectedDraw = _item
        }
      }
      for(let i=0;i<this.controlDots.length;i++) {
        const _dot = this.controlDots[i];
        const _dotPath2d = this.drawModifyDot(_dot)
        if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
          document.documentElement.style.cursor = _dot.cursor;
          this.tinkerUp = {code:_dot.code};
          if (_dot.wayIndex !== undefined && _dot.wayIndex !== null && _dot.wayIndex.constructor === Number) {
            this.tinkerUp['wayIndex'] = _dot.wayIndex
          }
          break;
        }
      }
    } else {
      this.selectedDraw = JSON.parse(JSON.stringify(this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)))
    }

    if (this.selectedDraw && !this.calcIsOnModifyRect(this.hoverPoint.x, this.hoverPoint.y) && !this.calcIsInsideDraw(this.hoverPoint.x, this.hoverPoint.y) && !this.tinkerUp && !this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)) {
      this.selectedDraw = null;
      this.modifyRect = null
    }
  }
  // 指针状态事件
  pointerDownFn(e){
    if (e.button === 0) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      }
      if (this.ctrlKey) {
        if (this.selectedDraw && !this.isObserver) {
          const _item = this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)
          if (this.selectedDraw.constructor === Array && _item) {
            this.selectedDraw.push(JSON.parse(JSON.stringify(_item)))
          }
          if (this.selectedDraw.constructor === Object && _item) {
            this.selectedDraw = [this.selectedDraw, JSON.parse(JSON.stringify(_item))]
          }
        }
      } else {
        if (this.spaceBar && !this.draging) {
          this.pencilPressing = true;
          this.draging = true;
          this.dragDownPoint = {
            x: e.offsetX - this.dragOffset.x,
            y: e.offsetY - this.dragOffset.y
          }
          return;
        }
        if (!this.isObserver) {
          this.findOutFoucusDraw()

          if (this.pencilPressing) {
            return;
          }
          this.pencilPressing = true;
          this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y)
        }
      }
    }
    if (e.button === 2 ) {
      if (!this.draging) {
        this.rightPressing = true;
        this.pencilPressing = true;
        this.draging = true;
        this.dragDownPoint = {
          x: e.offsetX - this.dragOffset.x,
          y: e.offsetY - this.dragOffset.y
        }
        return;
      }
      if (!this.isObserver) {
        this.findOutFoucusDraw()

        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y)
      }
    }
  }
  pointerMoveFn(e){
    this.hoverDraw = null;
    if ((this.spaceBar || this.rightPressing) && this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX-this.dragDownPoint.x
      this.dragOffset['y'] = e.offsetY-this.dragDownPoint.y
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    if (!this.pencilPressing) {
      if (this.isObserver) {
        this.hoverDraw = this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)
        return;
      }
      if (!this.pencilPosition) {
        if (!this.spaceBar) {
          document.documentElement.style.cursor = this.calcIsOnModifyRect(this.hoverPoint.x, this.hoverPoint.y) || this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y) || this.calcIsInsideDraw(this.hoverPoint.x, this.hoverPoint.y) ? 'move' : 'default'
        }
        
        if (this.selectedDraw) {
          for(let i=0;i<this.controlDots.length;i++) {
            const _dot = this.controlDots[i];
            const _dotPath2d = this.drawModifyDot(_dot);
            if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
              document.documentElement.style.cursor = _dot.cursor;
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
          if (this.selectedDraw.constructor === Object) {
            this.adjustSize(this.selectedDraw)
          }
        } else {
          // 整体移动
          if (this.selectedDraw.constructor === Object) {
            this.drawPointsWholeMove(this.selectedDraw, this.hoverPoint.x, this.hoverPoint.y)
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.drawPointsWholeMove(val, this.hoverPoint.x, this.hoverPoint.y)
            })
          }
        }
      } else {
        this.drawRect(this.hoverPoint.x, this.hoverPoint.y)
        this.tmpRect['fillStyle'] = 'rgba(187, 224, 255, 0.4)'
        this.tmpRect['strokeStyle'] = 'transparent'
        this.tmpRect['lineWidth'] =  1
      }
    }
  }
  pointerUpFn(e){
    if (this.rightPressing) {
      this.rightPressing = false;
    }
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX-this.dragDownPoint.x
      this.dragOffset['y'] = e.offsetY-this.dragDownPoint.y
      this.draging = false;
      this.pencilPressing = false;
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    if (this.pencilPressing ) {
      if (this.selectedDraw) {
        if (this.selectedDraw.constructor === Object) {
          let _item = this.originDraws[this.selectedDraw.index];
          // 修正翻转调整后的坐标错误偏差
          if (this.tinkerUp) {
            switch(this.tinkerUp.code) {
              case "tm":
              case "bm":
                if (_item.height < 0) {
                  // [a, b] = [b, a]; // es6 对调两个值
                  _item.y = _item.y + _item.height
                  _item.height = Math.abs(_item.height)
                }
                break;
              case "lm":
              case "rm":
                if (_item.width < 0) {
                  _item.x = _item.x + _item.width
                  _item.width = Math.abs(_item.width)
                }
                break;
              case "tr":
              case "bl":
              case "tl":
              case "br":
                if (_item.width < 0) {
                  _item.x = _item.x + _item.width
                  _item.width = Math.abs(_item.width)
                }
                if (_item.height < 0) {
                  _item.y = _item.y + _item.height
                  _item.height = Math.abs(_item.height)
                }
                break;
            }
          }
        }
        this.detectDrawsIsOverSize()
      } else {
        if (this.tmpRect) {
          // 检测有哪些draw在框选框内
          this.selectedDraw = this.detectDrawsOver()
          this.tmpRect = null;
        }
      }
      this.pencilPressing = false;
      this.tinkerUp = null;
    }
    
    this.pencilPosition = null;
  }
  // 矩形Draw事件
  rectDownFn(e) {
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    }
    if (e.button === 0) {
      if (this.pencilPressing) {
        return;
      }
      this.pencilPressing = true;
      this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y)
    }
  }
  rectMoveFn(e, options) {
    if (!this.pencilPressing) {
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    this.drawRect(this.hoverPoint.x, this.hoverPoint.y, options.label, options.strokeStyle)
  }
  rectUpFn(e, options) {
    if (!this.pencilPressing) {
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    this.pencilPressing = false;
    let someOneRect = this.drawRect(this.hoverPoint.x, this.hoverPoint.y, options.label, options.strokeStyle)
    const _dx = someOneRect.x+someOneRect.width;
    if (someOneRect.x > _dx) {
      someOneRect.x = _dx
    }
    const _dy = someOneRect.y+someOneRect.height
    if (someOneRect.y > _dy) {
      someOneRect.y = _dy
    }
    someOneRect['width'] = Math.abs(someOneRect.width)
    someOneRect['height'] = Math.abs(someOneRect.height)
    
    this.tmpRect = null;
    if (someOneRect.width > 20 || someOneRect.height > 20)  {
      // 记录已经画的rects
      someOneRect['id'] = this.uuidv4Short()
      this.originDraws.push(someOneRect)
      this.detectDrawsIsOverSize()
      this.selectedDraw = JSON.parse(JSON.stringify({
        data: this.originDraws[this.originDraws.length-1],
        index: (this.originDraws.length-1)
      }))
    }
    this.setDrawType('pointer', false)
    this.pencilPosition = null;
  }
  // 多边形事件
  polygonDownFn(e) {
    if (e.button === 0) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      }
      this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y)
    }
  }
  polygonMoveFn(e) {
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    this.drawPolygon(false, true)
  }
  polygonUpFn(e) {
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    if (this.detectIsDBClick(e.timeStamp)) {
      this.setDrawType('pointer', false)
      this.tmpPolygon['id'] = this.uuidv4Short()
      this.tmpPolygon['closed'] = true;
      this.pencilPosition = null;
      this.detectDrawsIsOverSize()
      this.originDraws.push(this.tmpPolygon)
      this.tmpPolygon = null;
      this.selectedDraw = JSON.parse(JSON.stringify({
        data: this.originDraws[this.originDraws.length-1],
        index: (this.originDraws.length-1)
      }))
    } else {
      this.drawPolygon()
    }
  }
  // 笔刷事件
  brushDownFn(e) {
    if (e.button === 0 && !this.pencilPressing) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      }
      this.pencilPressing = true;
      this.tmpPath2d = new Path2D()
      this.tmpPath2d.moveTo((this.hoverPoint.x-this.dragOffset.x)/this.zoomSize, (this.hoverPoint.y-this.dragOffset.y)/this.zoomSize)
    }
  }
  brushMoveFn(e){
    if (this.pencilPressing) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY,
      }
      if (this.tmpPath2d) {
        this.tmpPath2d.lineTo((this.hoverPoint.x-this.dragOffset.x)/this.zoomSize, (this.hoverPoint.y-this.dragOffset.y)/this.zoomSize)
      }
    }
  }
  brushUpFn(e){
    if (this.pencilPressing) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY,
      }
      if (this.tmpPath2d) {
        this.tmpPath2d.lineTo((this.hoverPoint.x-this.dragOffset.x)/this.zoomSize, (this.hoverPoint.y-this.dragOffset.y)/this.zoomSize)
        this.originDraws.push({
          type: 'brush',
          path: this.tmpPath2d
        })
        this.tmpPath2d = null;
      }
      this.pencilPressing = false
    }
  }
  // 橡皮檫事件
  eraserDownFn(e){
    if (e.button === 0 && !this.pencilPressing) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      }
      
      this.tmpPath2d = new Path2D()
      this.tmpPath2d.moveTo((this.hoverPoint.x-this.dragOffset.x)/this.zoomSize, (this.hoverPoint.y-this.dragOffset.y)/this.zoomSize)
      this.pencilPressing = true;
    }
  }
  eraserMoveFn(e){
    if (this.pencilPressing){
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      }
      if (this.tmpPath2d) {
        this.tmpPath2d.lineTo((this.hoverPoint.x-this.dragOffset.x)/this.zoomSize, (this.hoverPoint.y-this.dragOffset.y)/this.zoomSize)
      }
    }
  }
  eraserUpFn(e){
    if (this.pencilPressing){
      if (this.tmpPath2d) {
        this.originDraws.push({
          type: 'eraser',
          path: this.tmpPath2d
        })
        this.tmpPath2d = null;
      }
      this.pencilPressing = false;
    }
  }
  // 设定画笔点击坐标
  setPencilPosition(x, y) {
    this.pencilPosition = {
      x,
      y,
    }
  }
  // 检测有哪些draw在框选框内
  detectDrawsOver(){
    let tmp_selectedDraw = []
    if (this.tmpRect && this.originDraws && this.originDraws.constructor === Array && this.originDraws.length) {
      this.originDraws.forEach((val, index) => {
        if (val.type === 'rect') {
          if (val.x >= this.tmpRect.x && (this.tmpRect.x+this.tmpRect.width)>=(val.x+val.width) && val.y >= this.tmpRect.y && (this.tmpRect.y+this.tmpRect.height)>=(val.y+val.height)) {
            tmp_selectedDraw.push({data:val, index:index});
          }
        }
        if (val.type === 'polygon') {
          const _modifyRect = this.findOut4Poles(val, true)
          if (_modifyRect.x >= this.tmpRect.x && (this.tmpRect.x+this.tmpRect.width)>=(_modifyRect.x+_modifyRect.width) && _modifyRect.y >= this.tmpRect.y && (this.tmpRect.y+this.tmpRect.height)>=(_modifyRect.y+_modifyRect.height)) {
            tmp_selectedDraw.push({data:val, index:index});
          }
        }
      })
    }
    if (tmp_selectedDraw.length) {
      if (tmp_selectedDraw.length === 1) {
        tmp_selectedDraw = tmp_selectedDraw[0]
      }
      return JSON.parse(JSON.stringify(tmp_selectedDraw))
    } else {
      return null;
    }
  }
  // 导出draws数据
  exportDrawsData() {
    return this.originDraws.filter(val=>{
      if (val.type !== 'brush' && val.type !== 'eraser') {
        val['x'] = this.normalFloat(val.x)
        val['y'] = this.normalFloat(val.y)
        val['width'] = val.width ? this.normalFloat(val.width) : undefined
        val['height'] = val.height ? this.normalFloat(val.height) : undefined
        if (val.ways) {
          val.ways.forEach((wval)=>{
            wval['x'] = this.normalFloat(wval.x)
            wval['y'] = this.normalFloat(wval.y)
          })
        }
        return val
      }
    })
  }
  // 获取起点与终点之间的尺寸
  getDeltaSize(x, y) {
    let _deltas = {
      width : (x - this.pencilPosition.x)/this.zoomSize, 
      height: (y - this.pencilPosition.y)/this.zoomSize 
    }
    return _deltas;
  }
  // 调整框框插件
  adjustmentAddon(item, gap=0) {
    switch(item.type) {
      case "modifyRect":
        this.controlDots = [
          {
            x: item.x - gap,
            y: item.y - gap,
            cursor: 'nwse-resize',
            code: 'tl',
          },
          {
            x: item.x+item.width + gap, 
            y: item.y - gap,
            cursor: 'nesw-resize',
            code: 'tr',
          },
          {
            x: item.x+item.width + gap, 
            y: item.y+item.height + gap,
            cursor: 'nwse-resize',
            code: 'br',
          },
          {
            x: item.x - gap, 
            y: item.y+item.height + gap,
            cursor: 'nesw-resize',
            code: 'bl',
          }
        ]
        break;
      case "rect":
        this.controlDots = [
          {
            x: item.x - gap,
            y: item.y - gap,
            cursor: 'nwse-resize',
            code: 'tl',
          },
          {
            x: item.x+(item.width+gap)/2 , 
            y: item.y - gap,
            cursor: 'ns-resize',
            code: 'tm',
          },
          {
            x: item.x+item.width + gap, 
            y: item.y - gap,
            cursor: 'nesw-resize',
            code: 'tr',
          },
          {
            x: item.x+item.width + gap, 
            y: item.y+(item.height+gap)/2,
            cursor: 'ew-resize',
            code: 'rm',
          },
          {
            x: item.x+item.width + gap, 
            y: item.y+item.height + gap,
            cursor: 'nwse-resize',
            code: 'br',
          },
          {
            x: item.x+(item.width+gap)/2, 
            y: item.y+item.height + gap,
            cursor: 'ns-resize',
            code: 'bm',
          },
          {
            x: item.x - gap, 
            y: item.y+item.height + gap,
            cursor: 'nesw-resize',
            code: 'bl',
          },
          {
            x: item.x-gap, 
            y: item.y+(item.height+gap)/2,
            cursor: 'ew-resize',
            code: 'lm',
          }
        ]
        break;
      case "polygon":
        this.controlDots = [
          {
            x: item.x,
            y: item.y,
            cursor: 'ns-resize',
            code: 'pp',
          },
        ]
        if (item.ways) {
          item.ways.forEach((val,index)=>{
            this.controlDots.push({
              x: val.x,
              y: val.y,
              cursor: 'ns-resize',
              code: `pp`,
              wayIndex: index
            })
          })
        }
        
        break;
    }
    this.sbCtx.fillStyle = '#2ac2e4';
    this.controlDots.forEach(val => {
      const circle = this.drawModifyDot(val)
      this.sbCtx.fill(circle);
    })
  }
  // 初始化画笔样式
  initPencilStyle(stroke, size, fill) {
    // this.sbCtx.setLineDash([]);
    this.sbCtx.strokeStyle = stroke !== undefined ? stroke : this.options.pencilStyle.strokeStyle
    this.sbCtx.lineWidth = ( size !== undefined ? size : this.options.pencilStyle.lineWidth ) / this.zoomSize
    this.sbCtx.fillStyle = fill !== undefined ? fill : 'transparent'
  }
  setBrushStyle(size, color) {
    if (size){
      this.options.pencilStyle['brushSize'] = size
    }
    if (color) {
      this.options.pencilStyle['brushColor'] = color
    }
  }
  // 设置draws数据(外部接口)
  setDrawsData(data) {
    this.selectedDraw = null;
    this.originDraws = data 
  }
  // 绘制标签
  labelRect(rect, zoomSize=1, isObserver=false) {
    if (rect.label && !isObserver) {
      this.sbCtx.fillStyle = rect.strokeStyle || this.options.pencilStyle.strokeStyle
      const _fontSize = 18;
      const _height = (_fontSize+6)/zoomSize;
      const _fontOriginSize = _fontSize/zoomSize
      const _paddingLeft = 2/zoomSize;
      const _y = rect.y+_fontSize/zoomSize
      if (rect.width && rect.width > 50/zoomSize) {
        const _width = rect.width/2
        const _x = rect.x+_width;
        const _fx = _x + _paddingLeft
        this.sbCtx.fillRect(_x, rect.y, _width, _height);
        this.sbCtx.font=`${_fontOriginSize}px Arial`;
        this.sbCtx.fillStyle = "#fff"
        this.sbCtx.fillText(this.fittingString(this.sbCtx, rect.label, _width-_paddingLeft), _fx, _y);
      } else if (!rect.width) {
        const _strWidth = this.sbCtx.measureText(rect.label).width;
        const _width = _strWidth+ 6/zoomSize
        const _x = rect.x;
        const _fx = _x + _paddingLeft
        this.sbCtx.fillRect(_x, rect.y, _width, _height);
        this.sbCtx.font=`${_fontOriginSize}px Arial`;
        this.sbCtx.fillStyle = "#fff"
        this.sbCtx.fillText(rect.label, _fx, _y);
      }
    }
  }
  // 在Draw外绘制标签
  labelOutsideDraw(rect, zoomSize=1, isObserver) {
    if (rect.label && isObserver) {
      this.sbCtx.fillStyle = rect.strokeStyle || this.options.pencilStyle.strokeStyle
      const _fontSize = 18;
      const _height = (_fontSize+6)/zoomSize;
      const _fontOriginSize = _fontSize/zoomSize
      const _strWidth = this.sbCtx.measureText(rect.label).width+6/zoomSize;
      const _x = rect.x <= 0 ? 0 : rect.x-3/zoomSize;
      const _paddingLeft = 2/zoomSize;
      const _fx = _x + _paddingLeft
      const _y = rect.y - _height + _fontSize/zoomSize
      this.sbCtx.fillRect(_x, rect.y-_height, _strWidth, _height);

      this.sbCtx.font=`${_fontOriginSize}px Arial`;
      this.sbCtx.fillStyle = "#fff"
      this.sbCtx.fillText(rect.label, _fx, _y);
    }
  }
  // 重组显示文字
  fittingString(_ctx, str, maxWidth) {
    let strWidth = _ctx.measureText(str).width;
    const ellipsis = '...';
    const ellipsisWidth = _ctx.measureText(ellipsis).width;
    if (strWidth < maxWidth) {
      return str
    } else {
      var len = str.length;
      while (strWidth >= maxWidth - ellipsisWidth && len-- > 0) {
        str = str.slice(0, len);
        strWidth = _ctx.measureText(str).width;
      }
      return str + ellipsis;
    }
  }
  // 设置是否显示隐藏draws, 临时的不会隐藏
  setHiddenDraws(params=true) {
    this.selectedDraw = null;
    this.hiddenDraws = params;
  }
  // 绘制画面
  renderBoard() {
    this.clearWhole(false)
    this.sbCtx.setTransform(1, 0, 0, 1, 0, 0)
    this.sbCtx.scale(this.zoomSize, this.zoomSize)
    this.sbCtx.translate(this.dragOffset.x/this.zoomSize, this.dragOffset.y/this.zoomSize)
    
    this.sbCtx.globalCompositeOperation = "source-over";
    if (this.existBrushObj) {
      this.sbCtx.drawImage(this.existBrushObj.data, 0, 0)
    }
    
    this.originDraws.forEach(val => {
      switch (val.type) {
        case "eraser":
          this.sbCtx.globalCompositeOperation = "destination-out";
          this.sbCtx.strokeStyle = '#fff'
          this.sbCtx.lineWidth = this.options.pencilStyle.brushSize;
          this.sbCtx.stroke(val.path)
          this.sbCtx.globalCompositeOperation = "source-over";
          break;
        case "brush":
          this.sbCtx.lineWidth = this.options.pencilStyle.brushSize;
          this.sbCtx.strokeStyle = this.options.pencilStyle.brushColor
          this.sbCtx.stroke(val.path)
          break;
      }
    });
    
    // // 临时笔刷
    if (this.tmpPath2d) {
      if (this.drawType === 'eraser') {
        this.sbCtx.globalCompositeOperation = "destination-out";
        this.sbCtx.lineWidth =  this.options.pencilStyle.brushSize;
        this.sbCtx.strokeStyle = '#fff'
        this.sbCtx.stroke(this.tmpPath2d)
        this.sbCtx.globalCompositeOperation = 'source-over';
      }
      if (this.drawType === 'brush') {
        this.sbCtx.lineWidth =  this.options.pencilStyle.brushSize;
        this.sbCtx.strokeStyle = this.options.pencilStyle.brushColor
        this.sbCtx.stroke(this.tmpPath2d)
      }
    }

    if (this.isObserver && this.hoverDraw) {
        const _draw = this.hoverDraw.data
        switch (_draw.type) {
          case 'rect':
            this.initPencilStyle(_draw.strokeStyle, _draw.lineWidth)
            this.sbCtx.strokeRect(
              _draw.x,
              _draw.y,
              _draw.width,
              _draw.height
            );
            if (_draw.label){
              this.labelOutsideDraw(_draw, this.zoomSize, this.isObserver)
            }
            break;
          case "polygon":
            this.sbCtx.strokeStyle = 'red'
            if (_draw.label){
              this.labelOutsideDraw(_draw, this.zoomSize, this.isObserver)
            }
            this.sbCtx.beginPath();
            this.sbCtx.moveTo(_draw.x, _draw.y)
            _draw.ways.forEach(wval => {
              this.sbCtx.lineTo(wval.x, wval.y)
            })
            this.sbCtx.closePath();
            this.initPencilStyle(_draw.strokeStyle, _draw.lineWidth)
            this.sbCtx.stroke()
            
            break;
        }
    } else {
      this.originDraws.forEach(val => {
        switch (val.type) {
          case 'rect':
            if (this.hiddenDraws) {
              if(!val.label) {
                this.initPencilStyle(val.strokeStyle, val.lineWidth)
                this.sbCtx.strokeRect(
                  val.x,
                  val.y,
                  val.width,
                  val.height
                );
              }
            } else {
              this.initPencilStyle(val.strokeStyle, val.lineWidth)
              this.sbCtx.strokeRect(
                val.x,
                val.y,
                val.width,
                val.height
              );
              if (val.label){
                this.labelRect(val, this.zoomSize, this.isObserver);
              }
            }
            
            break;
          case "polygon":
            this.sbCtx.strokeStyle = 'red'
            if (val.label){
              this.labelRect(val, this.zoomSize, this.isObserver);
            }
            this.sbCtx.beginPath();
            this.sbCtx.moveTo(val.x, val.y)
            val.ways.forEach(wval => {
              this.sbCtx.lineTo(wval.x, wval.y)
            })
            this.sbCtx.closePath();
            this.initPencilStyle(val.strokeStyle, val.lineWidth)
            this.sbCtx.stroke()
            break;
        }
      })
    }
    
    // 临时矩形
    if (this.tmpRect) {
      const _tmpRect = new Path2D()
      _tmpRect.rect(
        this.tmpRect.x,
        this.tmpRect.y,
        this.tmpRect.width,
        this.tmpRect.height,
      )
      this.initPencilStyle(this.tmpRect.strokeStyle, this.tmpRect.lineWidth, this.tmpRect.fillStyle)
      if (this.tmpRect.fillStyle) {
        this.sbCtx.fill(_tmpRect);
      }
      this.sbCtx.stroke(_tmpRect);
    }
    // 临时多边形
    if (this.tmpPolygon) {
      this.sbCtx.beginPath()
      this.sbCtx.moveTo(this.tmpPolygon.x, this.tmpPolygon.y)
      this.tmpPolygon.ways.forEach(val => {
        this.sbCtx.lineTo(val.x, val.y)
      })
      if (this.tmpPolygon.closed){
        this.sbCtx.closePath()
      } else {
        this.sbCtx.lineTo((this.hoverPoint.x-this.dragOffset.x)/this.zoomSize, (this.hoverPoint.y-this.dragOffset.y)/this.zoomSize)
      }
      this.initPencilStyle(this.tmpPolygon.strokeStyle, this.tmpPolygon.lineWidth)
      this.sbCtx.stroke()
    }
    
    if (this.selectedDraw) {
      if (this.selectedDraw.constructor === Object) {
        const item = this.originDraws[this.selectedDraw.index];
        this.adjustmentAddon(item)
      }
      if (this.selectedDraw.constructor === Array) {
        this.drawOutsideAddon()
      }
    }
    // this.scrollbarSystem()
    
    // 设置背景图
    if (this.bgObj) {
      this.sbCtx.globalCompositeOperation = "destination-over";
      this.sbCtx.drawImage(this.bgObj.data, 0, 0)
    }
    window.requestAnimationFrame(()=>this.renderBoard())
    
  }
  // 滚动缩放
  sbDomWheel(e) {
    const _wheelDelta = e.wheelDelta;
    if ((this.ctrlKey || this.altKey) && Math.abs(_wheelDelta) > 0) {
      if (_wheelDelta > 0) {
        this.zoomIn(0.020)
      } else {
        this.zoomOut(0.020)
      }
    }
    e.preventDefault()
    e.stopPropagation()
  }
  // 侦测被选中draw
  deleteSelectedDraw() {
    if (this.selectedDraw) {
      if (this.selectedDraw.constructor === Object) {
        this.originDraws.splice(this.selectedDraw.index, 1)
      }
      if (this.selectedDraw.constructor === Array) {
        const _indexs = this.selectedDraw.map(val => val.index)
        this.originDraws = this.originDraws.filter((val, index) => {
          if (!_indexs.includes(index)) {
            return val;
          }
        })
      }
      this.selectedDraw = null;
      this.modifyRect = null;
    }
  }
  changeDrawPoints(index, coordinate='x', delta) {
    let _item = this.originDraws[index]
    _item[coordinate] = _item[coordinate] + delta
    if (_item.ways) {
      _item.ways.forEach(val=>{
        val[coordinate] = val[coordinate] + delta
      })
    }
  }
  renewSelectedDraw() {
    if (this.selectedDraw) {
      if (this.selectedDraw.constructor === Object) { 
        this.selectedDraw['data'] = JSON.parse(JSON.stringify(this.originDraws[this.selectedDraw.index]))
      }
      if (this.selectedDraw.constructor === Array) {
        const _selectedIndex = this.selectedDraw.map(val=>val.index);
        let _selectedOrigins =[] 
        this.originDraws.forEach((val, index) => {
          if (_selectedIndex.includes(index)) {
            _selectedOrigins.push({
              data: val,
              index
            })
          }
        });
        this.selectedDraw = JSON.parse(JSON.stringify(_selectedOrigins));
      }
    }
  }
  // 监听键盘按键释放
  sbDomKeyup(e) {
    const keycode = e.keyCode;
    if (keycode === 32){
      // 空格
      this.spaceBar = false;
      document.documentElement.style.cursor = 'default'
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if ( keycode === 18 ) {
      // alt
      this.altKey = false;
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if ( keycode === 17 ) {
      // ctrl || command 91
      this.ctrlKey = false;
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if ( keycode === 16 ) {
      // ctrl
      this.shiftKey = false;
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if (keycode === 8 || keycode === 46) {
      this.deleteSelectedDraw()
    }
    this.detectDrawsIsOverSize()
  }
  // 监听键盘按键按下
  sbDomKeydown(e) {
    const keycode = e.keyCode;
    // console.log(keycode)
    if ( keycode === 18 ) {
      // shift
      this.altKey = true;
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if ( keycode === 16 ) {
      // shift
      this.shiftKey = true;
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if (keycode === 17 ) {
      // ctrl || command 91
      this.ctrlKey = true;
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if (keycode === 27) {
      // esc
      this.selectedDraw = null;
      if (this.drawType !== 'pointer') {
        this.modifyRect = null;
        this.tmpPolygon = null;
        this.tmpRect = null;
        this.setDrawType('pointer')
        document.documentElement.style.cursor = 'default'
      }
      return;
    }
    if (keycode === 32){
      // 空格
      this.spaceBar = true;
      document.documentElement.style.cursor = 'grabbing'
      if (this.drawType!=='pointer'){
        this.setDrawType('pointer')
      }
      e.preventDefault()
      e.stopPropagation()
      return;
    }
    if (this.selectedDraw) {
      const _stepDelta = e.shiftKey ? 10 : 1;
      const _step = this.normalFloat(_stepDelta/this.zoomSize)
      switch(keycode) {
        case 37:
          // 左
          if (this.selectedDraw.constructor === Object) {
            this.changeDrawPoints(this.selectedDraw.index, 'x', -_step)
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.changeDrawPoints(val.index, 'x', -_step)
            })
          }
          break;
        case 39:
          // 右
          if (this.selectedDraw.constructor === Object) {
            this.changeDrawPoints(this.selectedDraw.index, 'x', _step)
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.changeDrawPoints(val.index, 'x', _step)
            })
          }
          break;
        case 38:
          // 上
          if (this.selectedDraw.constructor === Object) {
            this.changeDrawPoints(this.selectedDraw.index, 'y', -_step)
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.changeDrawPoints(val.index, 'y', -_step)
            })
          }
          break;
        case 40:
          // 下
          if (this.selectedDraw.constructor === Object) {
            this.changeDrawPoints(this.selectedDraw.index, 'y', _step)
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.changeDrawPoints(val.index, 'y', _step)
            })
          }
          break;
      }
      
      
    }
    
  }
  // 调整点的path2d
  drawModifyDot(dot){
    const _dotPath2d = new Path2D();
    _dotPath2d.arc(
      dot.x,
      dot.y,
      4/this.zoomSize, 
      0, 
      2*Math.PI
    );
    return _dotPath2d
  }
  // 滚动条系统
  scrollbarSystem() {
    
  }
  // 单个draw整体移动
  drawPointsWholeMove(item, x, y){
    let _sditem = item.data;
    let _ds = this.getDeltaSize(x, y)
    let _item = this.originDraws[item.index];
    _item.x = _sditem.x + _ds.width
    _item.y = _sditem.y + _ds.height
    // 兼容多边形
    if(_item.ways) {
      _item.ways.forEach((val, index)=>{
        val['x'] = _sditem.ways[index].x + _ds.width
        val['y'] = _sditem.ways[index].y + _ds.height
      })
    }
    return _item;
  }
  // 单控制点调整尺寸
  adjustSize(sdItem){
    // 调整尺寸
    const _sditem = sdItem.data;
    const _ds = this.getDeltaSize(this.hoverPoint.x, this.hoverPoint.y)
    
    let _item = this.originDraws[sdItem.index];
    switch(this.tinkerUp.code) {
      case "bm":
        _item.height = _sditem.height + _ds.height
        break;
      case "rm":
        _item.width = _sditem.width + _ds.width
        break;
      case "br":
        _item.height = this.shiftKey ? _sditem.width + _ds.width : _sditem.height + _ds.height
        _item.width = _sditem.width + _ds.width
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
        _item.height = _sditem.height - _ds.height
        _item.y = _sditem.y + _ds.height
        break;
      case "bl":
        _item.height = _sditem.height + _ds.height
        _item.width = _sditem.width - _ds.width
        _item.x = _sditem.x + _ds.width
        break;
      case "pp":
        if (this.tinkerUp.wayIndex !== undefined && this.tinkerUp.wayIndex !== null && this.tinkerUp.wayIndex.constructor === Number) {
          _item.ways[this.tinkerUp.wayIndex].x = _sditem.ways[this.tinkerUp.wayIndex].x + _ds.width
          _item.ways[this.tinkerUp.wayIndex].y = _sditem.ways[this.tinkerUp.wayIndex].y + _ds.height
        } else {
          _item.x = _sditem.x + _ds.width
          _item.y = _sditem.y + _ds.height
        }
        break;
    }
  }
  // 侦测draw组是否超出底图范围
  detectDrawsIsOverSize() {
    if (!this.bgObj) {
      return;
    }
    this.originDraws.forEach((oval, oindex) => {
      if (oval.type === 'rect') {
        // 右尽头
        if ((oval.x+oval.width) > this.bgObj.width){
          const _delta = Math.abs(this.bgObj.width-oval.width);
          oval['x'] = _delta
        }
        // 下尽头
        if ((oval.y + oval.height) > this.bgObj.height){
          const _delta = Math.abs(this.bgObj.height-oval.height);
          oval['y'] = _delta
        }
        // 上尽头
        if (oval.x<0){
          oval['x'] = 0
        }
        // 左尽头
        if (oval.y<0){
          oval['y'] = 0
        }
      }
    })
    this.renewSelectedDraw()
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
            _flag = {
              data: _item,
              index: i
            }
          }
          break;
        case "polygon":
          const _svgPath2d = this.drawToSvgPath(_item)
          if(this.sbCtx.isPointInStroke(_svgPath2d, x, y)){
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
  // blob 转成文件
  blobToFile(theBlob, fileName='exportPicture.png', options={type: "image/png"}){
    return new File([theBlob], fileName, options);
  }
  // base64 to blob数据
  b64toBlob(base64Data) {
    let byteString = atob(base64Data.split(',')[1]);
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: 'image/png' });
  }
  // 导出图片
  exportPic(options) {
    this.setDrawType('pointer')
    const _options = Object.assign({}, {
      type: 'origin', // draws, fusion, brush
      quality:1,
      // width: this.sbDom.width, 
      // height: this.sbDom.height, 
      file: {
        name: 'exportPicture.png', 
        options: {
          type: "image/png"
        }
      }
    }, options)
    return new Promise((resolve)=> {
      const _canvas = document.createElement('canvas');
      const _width = this.bgObj ? this.bgObj.width : this.sbDom.width
      const _height = this.bgObj ? this.bgObj.height : this.sbDom.height
      _canvas.width = _width
      _canvas.height = _height
      const _canvasCtx = _canvas.getContext('2d')
      if (this.existBrushObj) {
        _canvasCtx.drawImage(this.existBrushObj.data, 0, 0)
      }
      if (_options.type === 'draws' || _options.type === 'fusion' || _options.type === 'brush') {
        
        this.originDraws.forEach(val => {
          switch (val.type) {
            case "eraser":
              _canvasCtx.globalCompositeOperation = "destination-out";
              _canvasCtx.strokeStyle = '#fff'
              _canvasCtx.lineWidth = this.options.pencilStyle.brushSize;
              _canvasCtx.stroke(val.path)
              _canvasCtx.globalCompositeOperation = "source-over";
              break;
            case "brush":
              _canvasCtx.lineWidth = this.options.pencilStyle.brushSize;
              _canvasCtx.strokeStyle = this.options.pencilStyle.brushColor
              _canvasCtx.stroke(val.path)
              break;
          }
        });
        if (_options.type === 'draws' || _options.type === 'fusion') {
          this.originDraws.forEach(val => {
            switch (val.type) {
              case 'rect':
                _canvasCtx.strokeStyle = val.strokeStyle ? val.strokeStyle : this.options.pencilStyle.strokeStyle
                _canvasCtx.lineWidth = val.lineWidth ? val.lineWidth : this.options.pencilStyle.lineWidth
                _canvasCtx.strokeRect(
                  val.x,
                  val.y,
                  val.width,
                  val.height
                );
                break;
              case "polygon":
                _canvasCtx.beginPath();
                _canvasCtx.moveTo(val.x, val.y)
                val.ways.forEach(wval => {
                  _canvasCtx.lineTo(wval.x, wval.y)
                })
                _canvasCtx.closePath();
                _canvasCtx.strokeStyle = this.options.pencilStyle.strokeStyle
                _canvasCtx.lineWidth = this.options.pencilStyle.lineWidth
                _canvasCtx.stroke()
                break;
            }
          })
        }
      }
      
      if (_options.type === 'origin' || _options.type === 'fusion') {
        // 导出只有底图的图片
        if (this.bgObj) {
          _canvasCtx.globalCompositeOperation = "destination-over";
          _canvasCtx.drawImage(this.bgObj.data, 0, 0, _width, _height)
        }
      }
      const _img = _canvas.toDataURL('image/png', _options.quality)
      
      if (_img) {
        if (_options.file) {
          return resolve(this.blobToFile(this.b64toBlob(_img), _options.file.name, _options.file.options))
        }
        return resolve(_img)
      }
    })
  }
  // 计算画笔是否在modifyRect上 
  calcIsOnModifyRect(x, y){
    if (!this.modifyRect) {
      return false;
    }
    const _tmpRect = new Path2D()
    _tmpRect.rect(
      this.modifyRect.x,
      this.modifyRect.y,
      this.modifyRect.width,
      this.modifyRect.height
    )
    return this.sbCtx.isPointInStroke(_tmpRect, x, y) || this.sbCtx.isPointInPath(_tmpRect, x, y)
  }
  // 计算画笔是否在已选中的画图上
  calcIsInsideDraw(x, y) {
    let _final = false;
    if (this.selectedDraw) {
      if (this.selectedDraw.constructor === Object) {
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
          case "polygon":
            const _svgPath2d = this.drawToSvgPath(_item)
            _final = this.sbCtx.isPointInPath(_svgPath2d, x, y)
            break;
        }
      }
      if (this.selectedDraw.constructor === Array) {

      }
    }
    return _final;
  }
  // canvas路径转svg路径
  drawToSvgPath(polygon){
    let _svg_path = [`M${polygon.x} ${polygon.y}`]
    polygon.ways.forEach(val=>{
      _svg_path.push(`L${val.x} ${val.y}`)
    })
    _svg_path.push('Z')
    _svg_path = _svg_path.join(' ')
    return new Path2D(_svg_path)
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
  // 产生短id
  uuidv4Short() {
    return 'xxxx-4xxxyx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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
  // 绘画多边形
  drawPolygon(closed=false, moving=false) {
    if (!this.pencilPosition) {
      return
    }
    const _x = (this.pencilPosition.x - this.dragOffset.x)/this.zoomSize
    const _y = (this.pencilPosition.y - this.dragOffset.y)/this.zoomSize

    if (!this.tmpPolygon) {
      this.tmpPolygon = {
        x: _x,
        y: _y,
        ways: [],
        type: 'polygon'
      }
    } else {
      if (!moving) {
        this.tmpPolygon['ways'].push({
          x: _x,
          y: _y,
        })
      }
    }
    this.tmpPolygon['closed'] = closed;
  }
  // 绘画矩形
  drawRect(cx, cy, label, strokeStyle) {
    const _ds = this.getDeltaSize(cx, cy)
    const _x = (this.pencilPosition.x - this.dragOffset.x)/this.zoomSize
    const _y = (this.pencilPosition.y - this.dragOffset.y)/this.zoomSize
    this.tmpRect = {
      x: _x,
      y: _y,
      width: _ds.width, 
      height: _ds.height,
      type: 'rect',
      label,
      strokeStyle
    }
    return this.tmpRect
  }
}