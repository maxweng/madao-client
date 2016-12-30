
ionicApp
.factory('Coinprice', ['$resource', '$q',
function($resource, $q){
    var coinprice = $resource('/api', {}, {
        get: {
            method: 'GET',
            url: '/api/coinprice',
            timeout: 30000,
            interceptor: {
                responseError: function(responseError){
                    return $q.reject(responseError);
                }
            }
        }
    });

    return coinprice;
}])
;
