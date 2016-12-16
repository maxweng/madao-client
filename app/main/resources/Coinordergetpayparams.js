
ionicApp
.factory('Coinordergetpayparams', ['$resource', '$q',
function($resource, $q){
    var coinordergetpayparams = $resource('/api', {}, {
        add: {
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
