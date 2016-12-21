ionicApp
.factory('Wechat', ['$resource', '$q','$window','$rootScope',
function($resource, $q,$window,$rootScope){
    var inWechat = (/MicroMessenger/i).test(window.navigator.userAgent);
    var WXOauth = inWechat? $window.WXOauth :null;

    var Wechat = $resource('/api', {}, {
        wechat_login: {
            method: 'POST',
            url: '/api/wechatlogin',
            timeout: 8000,
            interceptor: {
                responseError: function(responseError){
                    return $q.reject(responseError);
                }
            }
        }
    });

    Wechat.hasAccessToken = function(){
        if(WXOauth && WXOauth.oauthData.access_token && WXOauth.oauthData.openid){
            return true;
        }else{
            return false;
        }
    }

    Wechat.getAccessToken = function(){
        console.log(WXOauth)
        console.log(location.href.split("#")[0])
        if(WXOauth)WXOauth.login(location.href.split("#")[0], undefined, false);
    }

    Wechat.loginWechat = function(_successCallback,_errorCallback){
        if(this.hasAccessToken()){
            console.log('wechathasToken')
            this.wechat_login({
                'access_token':WXOauth?WXOauth.oauthData.access_token:'',
                'openid':WXOauth?WXOauth.oauthData.openid:''
            },{}).$promise.then(function(){
                _successCallback();
            },function(err){
                _errorCallback(err);
            });
        }else{
            if(WXOauth){
                console.log('wechatnoToken')
                this.getAccessToken();
            }else{
                _errorCallback('请在微信中打开');
            }
        }
    }

    return Wechat;
}])
;
