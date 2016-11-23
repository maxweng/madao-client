'use strict';
ionicApp
.factory('Ether', ['$resource', '$q',
function(){
    var Ether = $resource('/api', {}, {
        getBalance: {
            method: 'POST'
        }
    })
}]);