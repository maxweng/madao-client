ionicApp.controller('productDetailCtrl', ['$scope',function($scope){
    $scope.views = {
        'gender':'男'
    }

    $scope.changeGender = function(gender){
        $scope.views.gender = gender;
    }
}])
;
