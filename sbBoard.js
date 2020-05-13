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
        lineWidth: 2,
        brushSize: 50,
        brushColor: 'blue'
      }
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
    this.tmpRect = null;
    this.bgObj = null;
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
    this.tmpTotalPath2d = null;

    this.pencilDownFn = null;
    this.pencilMoveFn = null;
    this.pencilUpFn = null;
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
    this.sbDom.oncontextmenu = function() {
      return false;
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
    let _selectedOrigins = this.originDraws.filter((val, index) => {
      if (_selectedIndex.includes(index)) {
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
    this.adjustmentAddon(this.modifyRect, _gap)
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
  }
  // 还原缩放
  zoomReset() {
    this.calcZoomedDragoffsetDeltaSize(false)
    this.dragOffset = {
      x: 0,
      y: 0
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
  // 工具栏用方法end
  // 设置画图类型
  setDrawType(params, publicUse=true) {
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
      this.pencilUpFn = null;
    }
    if (this[`${this.drawType}DownFn`]) {
      this.pencilDownFn = (e)=>this[`${this.drawType}DownFn`](e)
      this.sbDom.addEventListener('mousedown', this.pencilDownFn, false)
      this.pencilMoveFn = (e)=>this[`${this.drawType}MoveFn`](e)
      this.sbDom.addEventListener('mousemove', this.pencilMoveFn, false)
      this.pencilUpFn = (e)=>this[`${this.drawType}UpFn`](e)
      this.sbDom.addEventListener('mouseup', this.pencilUpFn, false)
      this.sbDom.addEventListener('mouseout', this.pencilUpFn, false)
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
        if (this.selectedDraw) {
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
        this.tinkerUp = null;
        if (this.selectedDraw) {
          // 判断是否单选情况
          const _item = JSON.parse(JSON.stringify(this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)))
          if (_item && this.selectedDraw.index !== _item.index) {
            this.selectedDraw = _item
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
        
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y)
      }
    }
  }
  pointerMoveFn(e){
    if (this.spaceBar && this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX-this.dragDownPoint.x
      this.dragOffset['y'] = e.offsetY-this.dragDownPoint.y
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    if (!this.pencilPressing) {
      if (!this.pencilPosition) {
        if (!this.spaceBar) {
          if (this.tmpTotalPath2d) {
            document.documentElement.style.cursor = this.sbCtx.isPointInPath(this.tmpTotalPath2d, this.hoverPoint.x, this.hoverPoint.y) || this.calcIsOnModifyRect(this.hoverPoint.x, this.hoverPoint.y) || this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y) || this.calcIsInsideDraw(this.hoverPoint.x, this.hoverPoint.y) ? 'move' : 'default'
          } else {
            document.documentElement.style.cursor = this.calcIsOnModifyRect(this.hoverPoint.x, this.hoverPoint.y) || this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y) || this.calcIsInsideDraw(this.hoverPoint.x, this.hoverPoint.y) ? 'move' : 'default'
          }
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
          if (this.selectedDraw.constructor === Array) {
            let _ds = this.getDeltaSize(this.hoverPoint.x, this.hoverPoint.y)
            
            switch(this.tinkerUp.code) {
              case "br":
                this.selectedDraw.forEach(sval => {
                  let _item = this.originDraws[sval.index];
                  if (_item.height!==undefined) {
                    _item.height = sval.data.height + _ds.height
                    _item.y = sval.data.y + _ds.height;
                  }
                  if (_item.width!==undefined) {
                    _item.width = sval.data.width + _ds.width
                  }
                })
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
            }
          }
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
      }
    }
  }
  pointerUpFn(e){
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
          this.detectDrawIsOverSize({data:_item, index:this.selectedDraw.index})
          this.selectedDraw.data = JSON.parse(JSON.stringify(_item));
        }
        if (this.selectedDraw.constructor === Array) {
          this.detectGroupDrawIsOverSize()
          const _selectedIndex = this.selectedDraw.map(val=>val.index);
          let _selectedOrigins =[] 
          this.originDraws.filter((val, index) => {
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
  rectMoveFn(e) {
    if (!this.pencilPressing) {
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    this.drawRect(this.hoverPoint.x, this.hoverPoint.y)
  }
  rectUpFn(e) {
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    this.pencilPressing = false;
    let someOneRect = this.drawRect(this.hoverPoint.x, this.hoverPoint.y)
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
      // someOneRect['id'] = this.generateUUID()
      this.detectDrawIsOverSize({data:someOneRect})
      this.originDraws.push(someOneRect)
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
      // this.tmpPolygon['id'] = this.generateUUID()
      this.tmpPolygon['closed'] = true;
      this.pencilPosition = null;
      this.detectDrawIsOverSize({data:this.tmpPolygon})
      this.originDraws.push(this.tmpPolygon)
      this.tmpPolygon = null;
      this.selectedDraw = JSON.parse(JSON.stringify({
        data: this.originDraws[this.originDraws.length-1],
        index: (this.originDraws.length-1)
      }))
    } else {
      this.drawPolygon()
      console.log(this.tmpPolygon)
    }
  }
  // 笔刷事件
  brushDownFn(e) {
    if (e.button === 0) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      }
      this.tmpPath2d = new Path2D()
      this.tmpPath2d.moveTo((this.hoverPoint.x-this.dragOffset.x)/this.zoomSize, (this.hoverPoint.y-this.dragOffset.y)/this.zoomSize)
    }
  }
  brushMoveFn(e){
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    if (this.tmpPath2d) {
      this.tmpPath2d.lineTo((this.hoverPoint.x-this.dragOffset.x)/this.zoomSize, (this.hoverPoint.y-this.dragOffset.y)/this.zoomSize)
    }
  }
  brushUpFn(e){
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
  }
  // 设定画笔点击坐标
  setPencilPosition(x, y) {
    this.pencilPosition = {
      x,
      y,
    }
  }
  // 导出draws数据
  exportDrawsData() {
    return this.originDraws.map(val=>{
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
    })
  }
  // 获取起点与终点之间的尺寸
  getDeltaSize(x, y) {
    return {
      width : (x - this.pencilPosition.x)/this.zoomSize, 
      height: (y - this.pencilPosition.y)/this.zoomSize 
    }
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
  initPencilStyle() {
    this.sbCtx.setLineDash([]);
    this.sbCtx.strokeStyle = this.options.pencilStyle.strokeStyle
    this.sbCtx.lineWidth = this.options.pencilStyle.lineWidth/this.zoomSize
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
    this.originDraws = data 
  }
  // 绘制画面
  renderBoard() {
    this.clearWhole(false)
    this.sbCtx.setTransform(1, 0, 0, 1, 0, 0)
    this.sbCtx.scale(this.zoomSize, this.zoomSize)
    this.sbCtx.translate(this.dragOffset.x/this.zoomSize, this.dragOffset.y/this.zoomSize)
    // 设置背景图
    if (this.bgObj) {
      this.sbCtx.drawImage(this.bgObj.data, 0, 0)
    }
    
    this.originDraws.forEach(val => {
      switch (val.type) {
        case "brush":
          this.sbCtx.lineWidth = this.options.pencilStyle.brushSize;
          this.sbCtx.strokeStyle = this.options.pencilStyle.brushColor
          this.sbCtx.stroke(val.path)
          break;
        case 'rect':
          this.initPencilStyle()
          this.sbCtx.strokeRect(
            val.x,
            val.y,
            val.width,
            val.height
          );
          break;
        case "polygon":
          this.sbCtx.strokeStyle = 'red'
          this.sbCtx.beginPath();
          this.sbCtx.moveTo(val.x, val.y)
          val.ways.forEach(wval => {
            this.sbCtx.lineTo(wval.x, wval.y)
          })
          this.sbCtx.closePath();
          this.initPencilStyle()
          this.sbCtx.stroke()
          break;
      }
    })
    // 临时矩形
    if (this.tmpRect) {
      const _tmpRect = new Path2D()
      _tmpRect.rect(
        this.tmpRect.x,
        this.tmpRect.y,
        this.tmpRect.width,
        this.tmpRect.height,
      )
      this.initPencilStyle()
      this.sbCtx.stroke(_tmpRect)
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
      this.initPencilStyle()
      this.sbCtx.stroke()
    }
    // 临时笔刷
    if (this.tmpPath2d) {
      this.sbCtx.lineWidth = this.options.pencilStyle.brushSize;
      this.sbCtx.strokeStyle = this.options.pencilStyle.brushColor
      this.sbCtx.stroke(this.tmpPath2d)
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
    
    window.requestAnimationFrame(()=>this.renderBoard())
    
  }
  // 滚动缩放
  sbDomWheel(e) {
    const _wheelDelta = e.wheelDelta;
    if (this.ctrlKey && Math.abs(_wheelDelta) > 0) {
      if (_wheelDelta > 0) {
        this.zoomIn(0.010)
      } else {
        this.zoomOut(0.010)
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
        this.drawType = 'pointer'
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
      let _renew_flag = true; 
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
      if (this.selectedDraw.constructor === Object && _renew_flag) { 
        this.selectedDraw['data'] = JSON.parse(JSON.stringify(this.originDraws[this.selectedDraw.index]))
      }
      if (this.selectedDraw.constructor === Array && _renew_flag) {
        this.detectGroupDrawIsOverSize()
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
    this.sbCtx.beginPath()
    this.sbCtx.lineCap = 'round'
    this.sbCtx.lineWidth = 8/this.zoomSize
    this.sbCtx.strokeStyle = 'rgba(143, 153, 63, .7)'
    let _width = this.bgObj ? this.bgObj.width : this.sbDom.width
    let _height = this.bgObj ? this.bgObj.height : this.sbDom.height
    
    let _calc_width = _width - 8/this.zoomSize - this.dragOffset.x/this.zoomSize
    let _calc_height = _height-5/this.zoomSize - this.dragOffset.y/this.zoomSize
    
    this.sbCtx.moveTo(_calc_width, 5/this.zoomSize - this.dragOffset.y/this.zoomSize)
    this.sbCtx.lineTo(_calc_width, _calc_height)
    this.sbCtx.stroke()

    this.sbCtx.beginPath()
    this.sbCtx.lineCap = 'round'
    this.sbCtx.lineWidth = 8/this.zoomSize
    this.sbCtx.strokeStyle = 'rgba(143, 153, 63, .7)'
    _width = this.bgObj ? this.bgObj.width : this.sbDom.width
    _height = this.bgObj ? this.bgObj.height : this.sbDom.height
    
    _calc_width = _width-5/this.zoomSize - this.dragOffset.x/this.zoomSize
    _calc_height = _height - 8/this.zoomSize - this.dragOffset.y/this.zoomSize
    
    this.sbCtx.moveTo(5/this.zoomSize - this.dragOffset.x/this.zoomSize, _calc_height)
    this.sbCtx.lineTo(_calc_width-5/this.zoomSize, _calc_height)
    this.sbCtx.stroke()
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
  detectGroupDrawIsOverSize() {
    const modifyRect = this.modifyRect;
    if (!modifyRect) {
      return;
    }
    if ((modifyRect.x+modifyRect.width) > this.bgObj.width){
      const _delta = Math.abs(this.bgObj.width-(modifyRect.x+modifyRect.width));
      this.selectedDraw.forEach(sval => {
        let _item = this.originDraws[sval.index]
        _item['x'] = _item.x-_delta
        if(_item.ways) {
          _item.ways.forEach((val, index)=>{
            val['x'] = val.x-_delta
          })
        }
      })
    }
    if ((modifyRect.y + modifyRect.height) > this.bgObj.height){
      const _delta = Math.abs(this.bgObj.height-(modifyRect.y + modifyRect.height));
      this.selectedDraw.forEach(sval => {
        let _item = this.originDraws[sval.index]
        _item['y'] = _item.y-_delta
        if(_item.ways) {
          _item.ways.forEach((val, index)=>{
            val['y'] = val.y-_delta
          })
        }
      })
    }
    if (modifyRect.x<0){
      this.selectedDraw.forEach(sval => {
        let _item = this.originDraws[sval.index]
        _item['x'] = _item.x - modifyRect.x
        if(_item.ways) {
          _item.ways.forEach((val, index)=>{
            val['x'] = val.x - modifyRect.x
          })
        }
      })
    }
    if (modifyRect.y<0){
      this.selectedDraw.forEach(sval => {
        let _item = this.originDraws[sval.index]
        _item['y'] = _item.y - modifyRect.y
        if(_item.ways) {
          _item.ways.forEach((val, index)=>{
            val['y'] = val.y - modifyRect.y
          })
        }
      })
    }
  }
  // 侦测是否超出图片范围
  detectDrawIsOverSize(item){
    const modifyRect = this.findOut4Poles(item)

    let _item = item.data;
    if ((modifyRect.x+modifyRect.width) > this.bgObj.width){
      const _delta = Math.abs(this.bgObj.width-(modifyRect.x+modifyRect.width));
      _item['x'] = _item.x-_delta
      if(_item.ways) {
        _item.ways.forEach((val, index)=>{
          val['x'] = val.x-_delta
        })
      }
    }
    if ((modifyRect.y + modifyRect.height) > this.bgObj.height){
      const _delta = Math.abs(this.bgObj.height-(modifyRect.y + modifyRect.height));
      _item['y'] = _item.y-_delta
      if(_item.ways) {
        _item.ways.forEach((val, index)=>{
          val['y'] = val.y-_delta
        })
      }
    }
    if (modifyRect.x<0){
      _item['x'] = _item.x - modifyRect.x
      if(_item.ways) {
        _item.ways.forEach((val, index)=>{
          val['x'] = val.x - modifyRect.x
        })
      }
    }
    if (modifyRect.y<0){
      _item['y'] = _item.y - modifyRect.y
      if(_item.ways) {
        _item.ways.forEach((val, index)=>{
          val['y'] = val.y - modifyRect.y
        })
      }
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
      type: 'origin', // draws, fusion
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
      // if (!isNaN(_options.width) && _options.width !== this.sbDom.width && _options.height === this.sbDom.height) {
      //   _options.height = this.normalFloat(_options.width / this.sbDom.width * this.sbDom.height)
      // }
      // if (!isNaN(_options.height) && _options.height !== this.sbDom.height && _options.width === this.sbDom.width) {
      //   _options.width = this.normalFloat(_options.height / this.sbDom.height * this.sbDom.width)
      // }
      const _width = this.bgObj ? this.bgObj.width : this.sbDom.width
      const _height = this.bgObj ? this.bgObj.height : this.sbDom.height
      // console.log(_width, this.sbDom.width)
      // const _zoomSize = this.normalFloat(_width/this.sbDom.width, 3)
      // console.log(_zoomSize)
      _canvas.width = _width
      _canvas.height = _height
      const _canvasCtx = _canvas.getContext('2d')
      if (_options.type === 'origin' || _options.type === 'fusion') {
        // 导出只有底图的图片
        _canvasCtx.drawImage(this.bgObj.data, 0, 0, _width, _height)
      }
      if (_options.type === 'draws' || _options.type === 'fusion') {
        // 导出只有draws的图片
        this.originDraws.forEach(val => {
          switch (val.type) {
            case 'brush':
              _canvasCtx.lineWidth = this.options.pencilStyle.brushSize;
              _canvasCtx.strokeStyle = this.options.pencilStyle.brushColor
              _canvasCtx.stroke(val.path)
              break;
            case 'rect':
              _canvasCtx.setLineDash([]);
              _canvasCtx.strokeStyle = this.options.pencilStyle.strokeStyle
              _canvasCtx.lineWidth = this.options.pencilStyle.lineWidth
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
              _canvasCtx.setLineDash([]);
              _canvasCtx.strokeStyle = this.options.pencilStyle.strokeStyle
              _canvasCtx.lineWidth = this.options.pencilStyle.lineWidth
              _canvasCtx.stroke()
              break;
          }
        })
      }
      
      
      const _img = _canvas.toDataURL('image/png', _options.quality)
      
      if (_img) {
        if (_options.file) {
          return resolve(this.blobToFile(this.b64toBlob(_img), _options.file.name, _options.file.options))
        }
        console.log(4)
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
  drawRect(cx, cy) {
    const _ds = this.getDeltaSize(cx, cy)
    const _x = (this.pencilPosition.x - this.dragOffset.x)/this.zoomSize
    const _y = (this.pencilPosition.y - this.dragOffset.y)/this.zoomSize
    this.tmpRect = {
      x: _x,
      y: _y,
      width: _ds.width, 
      height: _ds.height,
      type: 'rect',
    }
    return this.tmpRect
  }
}