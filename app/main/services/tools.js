'use strict';
ionicApp
.factory('tools', [
function(){
    return {
        hexEncode: function(text){
            var hex, i;
            var result = "";
            for (i=0; i<text.length; i++) {
                hex = text.charCodeAt(i).toString(16);
                result += ("000"+hex).slice(-4);
            }

            return "0x" + result;
        },
        noncestr: function(str){
            return str.substr(str.length-10,10);
        }
    }
}])
;
