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
    this.drawType = 'pointer'; // rect, polygon
    this.tmpPolygon = null // 存放临时 polygon 对象用
    this.zoomSize = 1;
    this.oldZoomSize = 1
    this.originDraws = []
    this.controlDots = []
    this.selectedDraw = null;
    this.spaceBar = false;
    this.draging = false;
    this.hoverPoint = {
      x: 0,
      y: 0,
    }
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
    if (publicUse) {
      this.originDraws = []
      this.selectedDraw = null;
      this.bgObj = null;
    }
    const clearSize ={
      width: this.sbDom.width/this.zoomSize,
      height: this.sbDom.height/this.zoomSize
    }
    this.sbCtx.clearRect(0, 0, clearSize.width*2, clearSize.height*2)
  }
  normalFloat(floatNumber=0, fixed=0) {
    return parseFloat(floatNumber.toFixed(fixed))
  }
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
  calcZoomedDragoffsetDeltaSize(zoomin=true){
    let _deltaWidth = Math.abs(this.bgObj.width*this.zoomSize-this.bgObj.width*this.oldZoomSize)/2
    let _deltaHeight = Math.abs(this.bgObj.height*this.zoomSize-this.bgObj.height*this.oldZoomSize)/2;
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
    this.zoomSize = this.bgObj.scaled;
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
  }
  // 设定画笔点击坐标
  setPencilPosition(x, y) {
    this.pencilPosition = {
      x,
      y,
    }
  }
  // 获取框框数据
  getDrawsData() {
    return this.originDraws.map(val=>{
      val['x'] = this.normalFloat(val.x)
      val['y'] = this.normalFloat(val.y)
      val['width'] = this.normalFloat(val.width)
      val['height'] = this.normalFloat(val.height)
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
  adjustmentAddon() {
    if (this.selectedDraw) {
      const item = this.originDraws[this.selectedDraw.index];
      switch(this.selectedDraw.data.type) {
        case "rect":
          this.controlDots = [
            {
              x: item.x,
              y: item.y,
              cursor: 'nwse-resize',
              code: 'tl',
            },
            {
              x: item.x+item.width/2, 
              y: item.y,
              cursor: 'ns-resize',
              code: 'tm',
            },
            {
              x: item.x+item.width, 
              y: item.y,
              cursor: 'nesw-resize',
              code: 'tr',
            },
            {
              x: item.x+item.width, 
              y: item.y+item.height/2,
              cursor: 'ew-resize',
              code: 'rm',
            },
            {
              x: item.x+item.width, 
              y: item.y+item.height,
              cursor: 'nwse-resize',
              code: 'br',
            },
            {
              x: item.x+item.width/2, 
              y: item.y+item.height,
              cursor: 'ns-resize',
              code: 'bm',
            },
            {
              x: item.x, 
              y: item.y+item.height,
              cursor: 'nesw-resize',
              code: 'bl',
            },
            {
              x: item.x, 
              y: item.y+item.height/2,
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
          item.ways.forEach(val=>{
            this.controlDots.push({
              x: val.x,
              y: val.y,
              cursor: 'ns-resize',
              code: 'pp',
            })
          })
          break;
      }
      this.sbCtx.fillStyle = '#2ac2e4';
      this.controlDots.forEach(val => {
        const circle = this.drawModifyDot(val)
        this.sbCtx.fill(circle);
      })
    }
  }
  initPencilStyle() {
    this.sbCtx.strokeStyle = this.options.pencilStyle.strokeStyle
    this.sbCtx.lineWidth = this.options.pencilStyle.lineWidth/this.zoomSize
  }
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
    this.initPencilStyle()
    this.originDraws.forEach(val => {
      switch (val.type) {
        case 'rect':
          this.sbCtx.strokeRect(
            val.x,
            val.y,
            val.width,
            val.height
          );
          break;
        case "polygon":
          this.sbCtx.beginPath();
          this.sbCtx.moveTo(val.x, val.y)
          val.ways.forEach(wval => {
            this.sbCtx.lineTo(wval.x, wval.y)
          })
          this.sbCtx.closePath();
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
        this.sbCtx.lineTo(this.hoverPoint.x/this.zoomSize, this.hoverPoint.y/this.zoomSize)
      }
      this.sbCtx.stroke()
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
      document.documentElement.style.cursor = 'default'
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
      document.documentElement.style.cursor = 'grabbing'
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
  // 画笔下笔事件方法
  pencilDown(e) {
    if (this.spaceBar && !this.draging) {
      this.selectedDraw = null;
      this.pencilPressing = true;
      this.draging = true;
      this.dragDownPoint = {
        x: e.offsetX - this.dragOffset.x,
        y: e.offsetY - this.dragOffset.y
      }
      return;
    }

    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    }
    
    this.tinkerUp = null;
    switch (this.drawType) {
      case "pointer":
        if (this.selectedDraw) {
          const _item = JSON.parse(JSON.stringify(this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)))
          if (_item && this.selectedDraw.data.id !== _item.data.id) {
            this.selectedDraw = _item
          }
          for(let i=0;i<this.controlDots.length;i++) {
            const _dot = this.controlDots[i];
            const _dotPath2d = this.drawModifyDot(_dot)
            if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
              document.documentElement.style.cursor = _dot.cursor;
              this.tinkerUp = _dot.code;
              break;
            }
          }
        } else {
          this.selectedDraw = JSON.parse(JSON.stringify(this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)))
        }

        if (this.selectedDraw && !this.calcIsInsideDraw(this.hoverPoint.x, this.hoverPoint.y) && !this.tinkerUp && !this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y)) {
          this.selectedDraw = null;
        }
        
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y)
        break;
      case "rect":
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y)
        break;
      case "polygon":
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y)
        break;
    }
  }
  // 画笔移动事件方法
  pencilMove(e) {
    if (this.spaceBar && this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX-this.dragDownPoint.x
      this.dragOffset['y'] = e.offsetY-this.dragDownPoint.y
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY,
    }
    switch (this.drawType) {
      case "pointer":
        if (!this.pencilPressing) {
          if (!this.pencilPosition) {
            if (!this.spaceBar) {
              document.documentElement.style.cursor = this.calcIsOnDrawPath(this.hoverPoint.x, this.hoverPoint.y) || this.calcIsInsideDraw(this.hoverPoint.x, this.hoverPoint.y) ? 'move' : 'default'
            }
            
            if (this.selectedDraw) {
              for(let i=0;i<this.controlDots.length;i++) {
                const _dot = this.controlDots[i];
                const _dotPath2d = this.drawModifyDot(_dot);
                if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
                  document.documentElement.style.cursor = _dot.cursor;
                  this.tinkerUp = _dot.code;
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
              const _ds = this.getDeltaSize(this.hoverPoint.x, this.hoverPoint.y)
              let _item = this.originDraws[this.selectedDraw.index];
              switch(this.tinkerUp) {
                case "bm":
                  _item.height = _sditem.height + _ds.height
                  break;
                case "rm":
                  _item.width = _sditem.width + _ds.width
                  break;
                case "br":
                  _item.height = _sditem.height + _ds.height
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
              }
            } else {
              // 整体移动
              const _sditem = this.selectedDraw.data;
              const _ds = this.getDeltaSize(this.hoverPoint.x, this.hoverPoint.y)
              let _item = this.originDraws[this.selectedDraw.index];
              _item.x = _sditem.x + _ds.width
              _item.y = _sditem.y + _ds.height
            }
          }
        }
        
        break;
      case 'rect':
        if (!this.pencilPressing) {
          return;
        }
        this.drawRect()
        break;
      case 'polygon':
        this.drawPolygon(false, true)
        break;
    }
  }
  // 画笔收笔方法
  pencilUp(e) {
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
            this.selectedDraw.data = JSON.parse(JSON.stringify(_item));
          }
          this.pencilPressing = false;
          this.tinkerUp = null;
        }
        
        this.pencilPosition = null;
        
        break;
      case "rect":
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
          someOneRect['id'] = this.generateUUID()
          this.originDraws.push(someOneRect)
          this.selectedDraw = JSON.parse(JSON.stringify({
            data: this.originDraws[this.originDraws.length-1],
            index: (this.originDraws.length-1)
          }))
        }
        this.setDrawType('pointer', false)
        this.pencilPosition = null;
        break;
      case 'polygon':
        if (this.detectIsDBClick(e.timeStamp)) {
          this.setDrawType('pointer', false)
          this.tmpPolygon['id'] = this.generateUUID()
          this.tmpPolygon['closed'] = true;
          this.pencilPosition = null;
          this.originDraws.push(this.tmpPolygon)
          this.tmpPolygon = null;
          this.selectedDraw = JSON.parse(JSON.stringify({
            data: this.originDraws[this.originDraws.length-1],
            index: (this.originDraws.length-1)
          }))
          
        } else {
          this.drawPolygon()
        }
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
            _flag = {
              data: _item,
              index: i
            }
          }
          break;
        case "polygon":
          let _svg_path = [`M${_item.x} ${_item.y}`]
          _item.ways.forEach(val=>{
            _svg_path.push(`L${val.x} ${val.y}`)
          })
          _svg_path.push('Z')
          _svg_path = _svg_path.join(' ')
          const _svgPath2d = new Path2D(_svg_path)
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