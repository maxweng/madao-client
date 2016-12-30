ionicApp
.factory('Me', ['$resource', '$q',
function($resource, $q){
    var Me = $resource('/api', {}, {
        get: {
            method: 'GET',
            url: '/api/me',
            timeout: 30000,
            interceptor: {
                responseError: function(responseError){
                    return $q.reject(responseError);
                }
            }
        },
        update: {
            method: 'POST',
            url: '/api/me',
            timeout: 30000,
            interceptor: {
                responseError: function(responseError){
                    return $q.reject(responseError);
                }
            }
        },
    });

    return Me;
}])
;
