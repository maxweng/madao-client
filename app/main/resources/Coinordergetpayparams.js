
ionicApp
.factory('Coinordergetpayparams', ['$resource', '$q',
function($resource, $q){
    var coinordergetpayparams = $resource('/api', {}, {
        get: {
            method: 'POST',
            url: '/api/coinordergetpayparams',
            timeout: 8000,
            interceptor: {
                responseError: function(responseError){
                    return $q.reject(responseError);
                }
            }
        }
    });

    return coinordergetpayparams;
}])
;
