ionicApp.filter('staticSrc', ['urlHandle', function(urlHandle){
    return function(src, size){
        if(!src){
            return '';
        }
        return urlHandle.parseImage(src, size);
    }
}])
;
