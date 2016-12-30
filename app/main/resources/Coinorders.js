ionicApp
.factory('Coinorders', ['$resource', '$q',
function($resource, $q){
    var coinorders = $resource('/api', {}, {
        get: {
            method: 'GET',
            url: '/api/coinorders',
            timeout: 30000,
            interceptor: {
                responseError: function(responseError){
                    return $q.reject(responseError);
                }
            }
        },
        add: {
            method: 'POST',
            url: '/api/coinorders',
            timeout: 30000,
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
