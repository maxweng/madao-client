'use strict';
ionicApp
.factory('urlHandle', ['APP_CONFIG', '$state',
function(APP_CONFIG, $state){
    var absoluteRegex = new RegExp('^\\s*(?:[a-z0-9]+:)?//', 'i');
    var UPAYYUN_HOSTS = ['media.jimaix.com', 'toughtalkuploadfile.b0.upaiyun.com'];
    return {
        parseToAbsolute: function(url){
            if(!this.isAbsoluteUrl(url)){
                if(url.indexOf('/') !== 0){
                    url = '/' + url;
                }
                return [APP_CONFIG.remote, url].join('');
            }else{
                return url;
            }
        },
        parseImage: function(src, size){
            var url = src;
            if(!this.isAbsoluteUrl(src)){
                url = APP_CONFIG.staticHost + url;
            }
            if(this.isUpaiYun(url) && size){
                url += '!' + size;
            }
            return url;
        },
        isAbsoluteUrl: function(url){
            return absoluteRegex.test(url);
        },
        isUpaiYun: function(url){
            if(!url){
                return false;
            }
            var isUpaiYun = false;
            for(var i = 0; i < UPAYYUN_HOSTS.length; i++){
                if(url.indexOf(UPAYYUN_HOSTS[i]) >= 0){
                    isUpaiYun = true;
                    break;
                }
            }
            return isUpaiYun
        },
        stateToUrl: function(stateName, params, isAbsoluteUrl){
            var url = location.pathname + $state.href(stateName, params);
            if(isAbsoluteUrl){
                url = this.parseToAbsolute(url);
            }
            return url;
        }
    }
}])
;
