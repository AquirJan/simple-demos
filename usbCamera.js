export default class usbCamera {
    constructor(options={}){
        this.options = Object.assign({
            media:{
                audio: false,
                video: true,
                // video: {
                //     width: { min: 1024, ideal: 1280, max: 1920 },
                //     height: { min: 776, ideal: 720, max: 1080 }
                //   }
            },
            camIndex: 0
        }, options)
        this.imageCaptureIns = null;
    }
    init(){
        return this.getCameraList()
    }
    getCameraList() {
        return new Promise(resolve => {
            navigator.mediaDevices.getUserMedia(this.options.media).then(mediaStream => {
                const track = mediaStream.getVideoTracks()[this.options.camIndex];
                this.imageCaptureIns = new ImageCapture(track);
                resolve({
                    success: true,
                    msg: 'usb相机就绪'
                })
            }).catch(err => {
                console.error(err);
                resolve({
                    success: false,
                    msg: 'usb相机未找到'
                })
            });
        })
    }
    async takePhotoBlob() {
        return await new Promise((resolve) => {
          this.imageCaptureIns.takePhoto().then(blob => {
            let reader = new FileReader();
            reader.readAsArrayBuffer(blob);
            reader.onload = e => {
              let buf = new Uint8Array(reader.result);
              resolve(buf);
            }
          });
        });
    }
}
