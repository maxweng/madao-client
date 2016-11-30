ionicApp
.factory('Me', ['$resource', '$q',
function($resource, $q){
    var Me = $resource('/api', {}, {
        get: {
            method: 'GET',
            url: '/api/me',
            timeout: 8000,
            interceptor: {
                responseError: function(responseError){
                    return $q.reject(responseError);
                }
            }
        }
    });

    return Me;
}])
;
