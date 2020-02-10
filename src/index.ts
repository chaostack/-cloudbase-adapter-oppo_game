import {
  IRequestOptions,
  IUploadRequestOptions,
  ResponseObject,
  SDKAdapterInterface,
  StorageType,
  AbstractSDKRequest,
  formatUrl,
  IRequestMethod,
  IRequestConfig
} from '@cloudbase/adapter-interface';

declare const qg;

function isFormData(val: any): boolean {
  return Object.prototype.toString.call(val) === '[object FormData]';
}

function isMatch(): boolean {
  if (typeof qg === 'undefined') {
    return false;
  }
  if (!qg.onHide) {
    return false;
  }
  if (!qg.offHide) {
    return false;
  }
  if (!qg.onShow) {
    return false;
  }
  if (!qg.offShow) {
    return false;
  }
  if (!qg.getSystemInfoSync) {
    return false;
  }
  if (!qg.getProvider) {
    return false;
  }
  try {
    if (!localStorage) {
      return false;
    }
    if (!localStorage.getItem) {
      return false;
    }
    if (!localStorage.setItem) {
      return false;
    }
    if (!WebSocket) {
      return false;
    }
    if (!XMLHttpRequest) {
      return false;
    }
  } catch (e) {
    return false;
  }

  try {
    const provider: string = qg.getProvider();
    if (provider.toLocaleUpperCase() !== 'OPPO') {
      return false;
    }

  } catch (e) {
    return false;
  }

  try {
    if (!qg.getSystemInfoSync()) {
      return false;
    }
  } catch (e) {
    return false;
  }

  return true;
}

class OppoRequest extends AbstractSDKRequest {
  // 默认不限超时
  private readonly _timeout: number;
  // 超时提示文案
  private readonly _timeoutMsg: string;
  // 超时受限请求类型，默认所有请求均受限
  private readonly _restrictedMethods: Array<IRequestMethod>;
  constructor(config: IRequestConfig = {}) {
    super();
    const { timeout, timeoutMsg, restrictedMethods } = config;
    this._timeout = timeout || 0;
    this._timeoutMsg = timeoutMsg || '请求超时';
    this._restrictedMethods = restrictedMethods || ['get', 'post', 'upload', 'download'];
  }
  public get(options: IRequestOptions): Promise<ResponseObject> {
    return this._request({
      ...options,
      method: 'get'
    }, this._restrictedMethods.indexOf('get') !== -1);
  }
  public post(options: IRequestOptions): Promise<ResponseObject> {
    return this._request({
      ...options,
      method: 'post'
    }, this._restrictedMethods.indexOf('post') !== -1);
  }
  public download(options: IRequestOptions) {
    const self = this;
    const {
      url,
      headers
    } = options;
    return new Promise((resolve, reject) => {
      let timer = null;
      const task = qg.downloadFile({
        url: formatUrl('https:', url),
        header: headers,
        success(res) {
          self._clearTimeout(timer);
          if (res.statusCode === 200 && res.tempFilePath) {
            // 由于涉及权限问题，只返回临时链接不保存到设备
            resolve({
              statusCode: 200,
              tempFilePath: res.tempFilePath
            });
          } else {
            resolve(res);
          }
        },
        fail(err) {
          self._clearTimeout(timer);
          reject(err);
        }
      });
      timer = self._setTimeout('download',task);
    });
  }
  public upload(options: IUploadRequestOptions): Promise<ResponseObject> {
    const self = this;
    return new Promise(async resolve => {
      let timer = null;
      const {
        url,
        file,
        data,
        headers
      } = options;
      const task = qg.uploadFile({
        url: formatUrl('https:', url),
        filePath: file,
        name: 'file',
        formData: {
          ...data,
          file
        },
        header: headers,
        success(res) {
          self._clearTimeout(timer);
          const result = {
            statusCode: res.statusCode,
            data: res.data || {}
          };
          // 200转化为201（如果指定）
          if (res.statusCode === 200 && data.success_action_status) {
            result.statusCode = parseInt(data.success_action_status, 10);
          }
          resolve(result);
        },
        fail(err) {
          self._clearTimeout(timer);
          resolve(err);
        }
      });
      timer = self._setTimeout('upload',task);
    });
  }
  protected _request(options: IRequestOptions, enableAbort: boolean = false): Promise<ResponseObject> {
    const self = this;
    const method = (String(options.method)).toLowerCase() || 'get';
    return new Promise(resolve => {
      const { url, headers = {}, data, responseType } = options;
      const realUrl = formatUrl('https:', url, method === 'get' ? data : {});
      const ajax = new XMLHttpRequest();
      ajax.open(method, realUrl);

      responseType && (ajax.responseType = responseType);
      // ajax.setRequestHeader('Accept', 'application/json');
      for (const key in headers) {
        ajax.setRequestHeader(key, headers[key]);
      }
      let timer;
      ajax.onreadystatechange = () => {
        if (ajax.readyState === 4) {
          self._clearTimeout(timer);
          const result: ResponseObject = {
            statusCode: ajax.status
          };
          try {
            // 上传post请求返回数据格式为xml，此处容错
            result.data = JSON.parse(ajax.responseText);
          } catch (e) { }
          resolve(result);
        }
      };
      if (enableAbort && this._timeout) {
        timer = setTimeout(() => {
          console.warn(this._timeoutMsg);
          ajax.abort();
        }, this._timeout);
      }
      ajax.send(method === 'post' && isFormData(data) ? (data as FormData) : JSON.stringify(data || {}));
    });
  }
  private _clearTimeout(timer:number|null){
    if(timer){
      clearTimeout(timer);
      timer = null;
    }
  }
  private _setTimeout(method:IRequestMethod,task):number|null{
    if(!this._timeout || this._restrictedMethods.indexOf(method) === -1){
      return null;
    }
    const timer = setTimeout(() => {
      console.warn(this._timeoutMsg);
      try{
        task.abort();
      }catch(e){}
    }, this._timeout);
    return timer;
  }
}

function genAdapter() {
  // 无sessionStorage
  const adapter: SDKAdapterInterface = {
    root: window,
    reqClass: OppoRequest,
    wsClass: WebSocket,
    localStorage: localStorage,
    primaryStorage: StorageType.local
  };
  return adapter;
}

const adapter = {
  genAdapter,
  isMatch,
  runtime: 'oppo_game'
}

try {
  window['tcbAdapterOppoGame'] = adapter;
  window['adapter'] = adapter;
}catch(e){}

export {
  adapter
};

export default adapter;