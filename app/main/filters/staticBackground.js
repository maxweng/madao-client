ionicApp.filter('staticBackground', ['urlHandle', function(urlHandle){
    return function(_src, size, def){
        var src = _src || def;
        if(!src){
            return '';
        }
        return {
            'background-image': ['url("', urlHandle.parseImage(src, size), '")'].join('')
        }
    }
}])
