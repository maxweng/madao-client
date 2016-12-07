ionicApp
.factory('Coinorders', ['$resource', '$q',
function($resource, $q){
    var coinorders = $resource('/api', {}, {
        get: {
            method: 'GET',
            url: '/api/coinorders',
            timeout: 8000,
            interceptor: {
                responseError: function(responseError){
                    return $q.reject(responseError);
                }
            }
        }
    });

    return coinorders;
}])
;
