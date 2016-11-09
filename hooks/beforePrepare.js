'use strict';
var replace = require('gulp-replace');

module.exports = function (context) {
    var gulp = context.requireCordovaModule('gulp');
    var q = context.requireCordovaModule('q');

    var deferred = q.defer();
    gulp.src('www/index.html')
        .pipe(replace('<!-- injectCordova -->', '<script src="cordova.js"></script>'))
        .pipe(gulp.dest('www'))
        .on('end', function () {
            deferred.resolve();
        });

    return deferred.promise;
};