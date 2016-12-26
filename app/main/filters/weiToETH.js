ionicApp.filter('weiToETH', ['ethUnits',function(ethUnits){
    return function(wei){
        if(!wei&&wei!=0) return;
        return ethUnits.toEther(wei, 'wei');
    }
}])
;
