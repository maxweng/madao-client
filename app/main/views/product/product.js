ionicApp.controller('productCtrl', ['$scope','Ether',function($scope,Ether){
    $scope.views = {
        'assistance':false,
        'problem':false
    }

    var address = '0x909403d1dc30d024fcb1d2766df3c56dd00d578f';

    Ether.getBalance({'balance':address,'isClassic':true}).$promise.then(function(res){
        console.log(res)
    })
}])
;
