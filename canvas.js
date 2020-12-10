/**
 * 微信canvas库封装
 * @author magic-zhu
 * @version 1.0.3
 */
/**
 * 当在组件中使用时需要传入 this (组件的this)
 */
class weappCanvas {

    constructor(canvasId, component) {
        this.vm = null;
        this.canvasId = canvasId;
        this.component = component;
        this.imageQueue = [];
        this.renderQuene = [];
        this.imageQueneBackup = [];
        this.canvasTempFilePath = '';
        this.init();
    }

    //初始化画布
    init() {
        this.vm = wx.createCanvasContext(this.canvasId, this.component);
        return this
    }

    //获取画布实例
    ins() {
        return this.vm
    }

    box(options) {
        let render = () => {
            this.boxRender(options);
        }
        this.renderQuene.push(render);
        return this
    }

    text(options) {
        let render = () => {
            this.textRender(options);
        }
        this.renderQuene.push(render);
        return this
    }

    image(options) {
        this.imageQueue.push(options);
        this.imageQueneBackup.push(options);
        let render = () => {
            this.imageRender(options);
        }
        this.renderQuene.push(render)
        return this
    }

    draw(save = false) {
        const _render = (callback) => {
            this.render();
            this.vm.draw(save, () => {
                callback()
            });
        }
        return new Promise(resolve => {
            if (this.imageQueue.length != 0) {
                this.preLoadImage()
                    .then(() => {
                        _render(resolve)
                    })
            } else {
                _render(resolve)
            }
        })
    }

    createImage(params) {
        if (!params) params = {};
        if (!params.canvasId) params.canvasId = this.canvasId;
        return new Promise(resolve => {
            if (this.canvasTempFilePath == '') {
                wx.canvasToTempFilePath({
                    ...params,
                    success: (res) => {
                        this.canvasTempFilePath = res.tempFilePath;
                        resolve(res.tempFilePath)
                    },
                    fail: (res) => {
                        throw new Error(res)
                    },
                }, this.component)
            } else {
                resolve(this.canvasTempFilePath)
            }
        })
    }

    saveImage(params) {
        wx.showLoading({
            title: '图片下载中...',
            mask: true,
        });
        let tempPath = '';
        this.createImage(params)
            .then(path => {
                tempPath = path;
                return this.checkAuthor()
            })
            .then(() => {
                return new Promise(resolve => {
                    wx.hideLoading();
                    wx.saveImageToPhotosAlbum({
                        filePath: tempPath,
                        success: () => {
                            wx.showToast({
                                title: '保存图片成功',
                                duration: 1500,
                                mask: false,
                            });
                            resolve()
                        },
                        fail: (err) => {
                            wx.showToast({
                                title: '保存图片失败',
                                duration: 1500,
                                mask: false,
                                icon: 'none'
                            });
                        },
                    });
                })
            })
    }

    setCanvasTempFilePath(path) {
        this.canvasTempFilePath = path
        return this
    }

    // =================内部方法=================

    _getSetting() {
        return new Promise((resolve) => {
            wx.getSetting({
                success: (res) => {
                    resolve(res)
                },
                fail: (err) => {
                    throw new Error(err)
                }
            })
        })
    }

    _showModal() {
        wx.showModal({
            title: '温馨提示',
            content: '检测到您曾经拒绝授权相册,是否重新授权',
            showCancel: true,
            cancelText: '我再想想',
            confirmText: '重新授权',
            success: (result) => {
                if (result.confirm) {
                    wx.openSetting({
                        fail: (err) => {
                            throw new Error(err)
                        },
                    });
                }
            },
            fail: (err) => {
                throw new Error(err)
            },
        });
    }

    checkAuthor() {
        return new Promise(resolve => {
            this._getSetting()
                .then((res) => {
                    //已授权 或者 从未授权过
                    if (res.authSetting['scope.writePhotosAlbum'] == undefined
                        || res.authSetting['scope.writePhotosAlbum']
                    ) {
                        resolve()
                    } else {//拒绝了授权
                        wx.hideLoading()
                        _this.showModal()
                    }
                });
        })
    }

    downLoadImage(url, index) {
        return new Promise(resolve => {
            if(url.indexOf('http')==-1){
                resolve(url)
            }else{
                wx.getImageInfo({
                    src: url,
                    success: (result) => {
                        this.imageQueue[index].swidth = result.width
                        this.imageQueue[index].sheight = result.height
                        resolve(result.path)
                    },
                    fail: (err) => {
                        throw new Error(err)
                    },
                })
            }
        })
    }

    preLoadImage() {
        return new Promise(resolve => {
            let t = this.imageQueue.map((item, index) => {
                return this.downLoadImage(item.url, index)
            })
            Promise.all(t)
                .then(res => {
                    res.forEach((item, index) => {
                        this.imageQueue[index].url = item
                    })
                    resolve()
                })
                .catch(err => {
                    throw new Error(err)
                })
        })
    }

    setBackground(options) {
        if (!options.backgroundColor) return null;
        let backgroundColor;
        if (typeof options.backgroundColor === 'string') {
            backgroundColor = options.backgroundColor;
        }
        if (typeof options.backgroundColor === 'object') {
            let { startX, startY, endX, endY, gradient } = options.backgroundColor;
            const grd = this.vm.createLinearGradient(startX, startY, endX, endY);
            for (let i = 0, l = gradient.length; i < l; i++) {
                grd.addColorStop(gradient[i].step, gradient[i].color);
            }
            backgroundColor = grd;
        }
        this.vm.setFillStyle(backgroundColor);
    }

    setBorder(options) {
        if (!options.border) return null;
        let { x, y } = options;
        let w = options.width;
        let h = options.height;
        if (options.border.width) this.vm.setLineWidth(options.border.width);
        if (options.border.color) this.vm.setStrokeStyle(options.border.color);
        let p = options.border.width / 2; //偏移距离
        //是否有圆角
        if (options.radius) {
            let r = options.radius;
            this.drawRadiusRoute(x - p, y - p, w + 2 * p, h + 2 * p, r + p);
            this.vm.stroke();
        } else {
            this.vm.strokeRect(x - p, y - p, w + 2 * p, h + 2 * p);
        }
    }

    setLineSpace(options) {
        if (options.lineSpace && (!options.fontSize || !options.overflow || options.overflow != 'wrap')) {
            console.error('lineSpace需要搭配fontSize和overflow:wrap来使用');
            return
        }
    }

    //带有圆角的路径绘制
    drawRadiusRoute(x, y, w, h, r) {
        this.vm.beginPath();
        this.vm.moveTo(x + r, y, y);
        this.vm.lineTo(x + w - r, y);
        this.vm.arc(x + w - r, y + r, r, 1.5 * Math.PI, 0);
        this.vm.lineTo(x + w, y + h - r);
        this.vm.arc(x + w - r, y + h - r, r, 0, 0.5 * Math.PI);
        this.vm.lineTo(x + r, y + h);
        this.vm.arc(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI);
        this.vm.lineTo(x, y + r);
        this.vm.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
        this.vm.closePath();
    }

    /**
     * 根据模式得到绘制图片需要的参数
     * @param {*} mode 
     * @param {*} imgWidth - 图片的真是宽度
     * @param {*} imgHeight - 图片的真实高度
     * @param {*} sWidth - 设定宽度
     * @param {*} sHeight - 设定高度
     */
    adjustImageByMode(mode, imgWidth, imgHeight, sWidth, sHeight, x, y) {
        let cx, cy, cw, ch, sx, sy, sw, sh;
        switch (mode) {
            case "aspectFill":
                if (imgWidth <= imgHeight) {
                    let p = imgWidth / sWidth;
                    cw = imgWidth;
                    ch = sHeight * p;
                    cx = 0;
                    cy = (imgHeight - ch) / 2;
                } else {
                    let p = imgHeight / sHeight;
                    cw = sWidth * p;
                    ch = imgHeight;
                    cx = (imgWidth - cw) / 2;
                    cy = 0;
                }
                break
            case "aspectFit":
                if (imgWidth <= imgHeight) {
                    let p = imgHeight / sHeight;
                    sw = imgWidth / p;
                    sh = sHeight;
                    sx = x + (sWidth - sw) / 2;
                    sy = y;
                } else {
                    let p = imgWidth / sWidth;
                    sw = sWidth;
                    sh = imgHeight / p;
                    sx = x;
                    sy = y + (sHeight - sh) / 2;
                }
                break
        }
        return { cx, cy, cw, ch, sx, sy, sw, sh }
    }

    /**
     * 获取字符串的字节长度
     * @param {String} value -输入值
     * @return {Number} 输出长度 字节
     */
    getStringByteLength(value) {
        let str = value;
        let bytes = 0;
        for (let i = 0, n = str.length; i < n; i++) {
            let c = str.charCodeAt(i);
            if ((c >= 0x0001 && c <= 0x007e) || (0xff60 <= c && c <= 0xff9f)) {
                bytes += 1;
            } else {
                bytes += 2;
            }
        }
        return bytes
    }
    /**
     * 截取指定字节位置的字符串
     * @param {String} value - 输入字符串
     * @param {Number} start - 开始位置
     * @param {Number} end  - 结束位置
     */
    sliceByByte(value, start, end) {
        let bytes = 0;
        let result = '';
        for (let i = 0, n = value.length; i < n; i++) {
            let c = value.charCodeAt(i);
            if (bytes >= end && end != undefined) {
                break
            }
            if (bytes >= start) {
                result = result + value[i];
            }
            if ((c >= 0x0001 && c <= 0x007e) || (0xff60 <= c && c <= 0xff9f)) {
                bytes += 1;
            } else {
                bytes += 2;
            }
        }
        return result
    }

    boxRender(options) {
        this.vm.save();
        this.setBackground(options);
        this.setBorder(options);
        this.setTransform(options);
        //区分是否有圆角采用不同模式渲染
        if (options.radius) {
            let { x, y } = options;
            let w = options.width;
            let h = options.height;
            let r = options.radius;
            this.drawRadiusRoute(x, y, w, h, r);
            this.vm.fill();
        } else {
            this.vm.fillRect(options.x, options.y, options.width, options.height);
        }
        this.vm.restore();
    }
    handleImageRadius(options){
        if (options.radius) {
            this.drawRadiusRoute(
                options.x,
                options.y,
                options.width || options.swidth,
                options.height || options.sHeight,
                options.radius
            );
            this.vm.clip();
        }
    }
    
    drawImageByMode(options){
        let temp = this.copy(this.imageQueue[0])
        if (options.mode) {
            let { cx, cy, cw, ch, sx, sy, sw, sh } = this.adjustImageByMode(
                options.mode,
                temp.swidth,
                temp.sheight,
                temp.width,
                temp.height,
                temp.x,
                temp.y
            );
            switch (options.mode) {
                case 'aspectFit':
                    this.vm.drawImage(temp.url, sx, sy, sw, sh,)
                    break;
                case 'aspectFill':
                    this.vm.drawImage(temp.url, cx, cy, cw, ch, temp.x, temp.y, temp.width, temp.height)
                    break;
            }
        } else {
            this.vm.drawImage(
                temp.url,
                temp.x,
                temp.y,
                temp.width || temp.swidth,
                temp.height || temp.sheight,
            )
        }
        this.imageQueue.shift()
    }

    copy(input){
        return JSON.parse(JSON.stringify(input))
    }

    textRender(options) {
        this.vm.save();
        this.setLineSpace(options);
        this.vm.setFontSize(options.fontSize || 16);
        this.vm.setFillStyle(options.color || '#000000');
        if (options.overflow == 'ellipsis') {
            if (!options.maxLength) {
                console.error('需要指定最大字节数');
                return
            }
            let text = this.sliceByByte(options.text, 0, options.maxLength) + '...';
            this.vm.fillText(text, options.x, options.y);
            return
        }
        if (options.overflow == 'wrap') {
            if (!options.maxLength) {
                console.error('需要指定最大字节数');
                return
            }
            let totalLines = Math.ceil(this.getStringByteLength(options.text) / options.maxLength);
            for (let i = 0; i < totalLines; i++) {
                let text = this.sliceByByte(options.text, i * options.maxLength, (i + 1) * options.maxLength);
                this.vm.fillText(text, options.x, i * (options.fontSize) + options.y + options.lineSpace * i);
            }
            return
        }
        this.vm.fillText(options.text, options.x, options.y);
        this.vm.restore();
    }

    imageRender(options) {
        this.vm.save()
        this.handleImageRadius(options)
        this.drawImageByMode(options)
        this.vm.restore()
    }

    render() {
        this.renderQuene.forEach(ele => {
            ele();
        })
        this.imageQueue = JSON.parse(JSON.stringify(this.imageQueneBackup));
    }
}
export default weappCanvas
