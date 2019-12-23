import {
  IRequestOptions,
  IUploadRequestOptions,
  ResponseObject,
  SDKAdapterInterface,
  StorageType,
  AbstractSDKRequest,
  formatUrl
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
  public get(options: IRequestOptions): Promise<ResponseObject> {
    return this._request({
      ...options,
      method: 'get'
    });
  }
  public post(options: IRequestOptions): Promise<ResponseObject> {
    return this._request({
      ...options,
      method: 'post'
    });
  }
  public download(options: IRequestOptions) {
    const {
      url,
      headers
    } = options;
    return new Promise((resolve, reject) => {
      qg.downloadFile({
        url: formatUrl('https:', url),
        header: headers,
        success(res) {
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
          reject(err);
        }
      });
    });
  }
  public upload(options: IUploadRequestOptions): Promise<ResponseObject> {
    return new Promise(async resolve => {
      const {
        url,
        file,
        data,
        headers
      } = options;
      qg.uploadFile({
        url: formatUrl('https:', url),
        filePath: file,
        name: 'file',
        formData: {
          ...data,
          file
        },
        header: headers,
        success(res) {
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
          resolve(err);
        }
      });
    });
  }
  protected _request(options: IRequestOptions): Promise<ResponseObject> {
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

      ajax.onreadystatechange = () => {
        if (ajax.readyState === 4) {
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
      ajax.send(method === 'post' && isFormData(data) ? (data as FormData) : JSON.stringify(data || {}));
    });
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
export {
  adapter
};