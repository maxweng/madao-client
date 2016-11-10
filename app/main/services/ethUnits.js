'use strict';
ionicApp
.factory('ethUnits', [function () {
    var ethUnits = {};
    ethUnits.unitMap = {
        'wei': '1',
        'kwei': '1000',
        'ada': '1000',
        'femtoether': '1000',
        'mwei': '1000000',
        'babbage': '1000000',
        'picoether': '1000000',
        'gwei': '1000000000',
        'shannon': '1000000000',
        'nanoether': '1000000000',
        'nano': '1000000000',
        'szabo': '1000000000000',
        'microether': '1000000000000',
        'micro': '1000000000000',
        'finney': '1000000000000000',
        'milliether': '1000000000000000',
        'milli': '1000000000000000',
        'ether': '1000000000000000000',
        'kether': '1000000000000000000000',
        'grand': '1000000000000000000000',
        'einstein': '1000000000000000000000',
        'mether': '1000000000000000000000000',
        'gether': '1000000000000000000000000000',
        'tether': '1000000000000000000000000000000'
    };
    ethUnits.getValueOfUnit = function (unit) {
        unit = unit ? unit.toLowerCase() : 'ether';
        var unitValue = this.unitMap[unit];
        if (unitValue === undefined) {
            throw new Error(globalFuncs.errorMsgs[4] + JSON.stringify(this.unitMap, null, 2));
        }
        return new BigNumber(unitValue, 10);
    };

    ethUnits.fiatToWei = function (number, pricePerEther) {
        var returnValue = new BigNumber(String(number)).div(pricePerEther).times(this.getValueOfUnit('ether')).round(0);
        return returnValue.toString(10);
    };

    ethUnits.toFiat = function (number, unit, multi) {
        var returnValue = new BigNumber(this.toEther(number, unit)).times(multi).round(5);
        return returnValue.toString(10);
    };

    ethUnits.toEther = function (number, unit) {
        var returnValue = new BigNumber(this.toWei(number, unit)).div(this.getValueOfUnit('ether'));
        return returnValue.toString(10);
    };

    ethUnits.toWei = function (number, unit) {
        var returnValue = new BigNumber(String(number)).times(this.getValueOfUnit(unit));
        return returnValue.toString(10);
    };

    return ethUnits;
}])
;