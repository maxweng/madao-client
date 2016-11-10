var gulp = require('gulp');
var concat = require('gulp-concat');
var cleanCSS = require('gulp-clean-css');
var rename = require('gulp-rename');
var mainBowerFiles = require('main-bower-files');
var path = require('path');
var clean = require('gulp-clean');
var uglify = require('gulp-uglify');
var inject = require('gulp-inject');
var hash = require('gulp-hash-filename');
var spawn = require('child_process').spawn;
var sass = require('gulp-sass');
var replace = require('gulp-replace');
var argv = require('yargs').argv;
var config = require('./app.json');
var browserify = require('gulp-browserify');

var app = argv.app || 'dev';
var clientBase = 'app';

var paths = {
    index: [
        'app/index.html'
    ],
    images: [
        'app/images/**/*'
    ],
    js: [
        'app/main/app.js',
        'app/main/constants/**/*.js',
        'app/main/directives/**/*.js',
        'app/main/filters/*.js',
        'app/main/services/**/*.js',
        'app/main/views/**/*.js',
        'app/main/resources/**/*.js'
    ],
    libs: [
        'app/libs/**/*'
    ],
    sass: [
        'app/main/app.scss',
        'app/main/directives/**/*.scss',
        'app/main/services/**/*.scss',
        'app/main/views/**/*.scss',
        'app/main/scss/**/*.scss'
    ],
    templates: [
        'app/main/directives/**/*.html',
        'app/main/services/**/*.html',
        'app/main/views/**/*.html'
    ],
    css: [
        'app/styles/app.css'
    ]
};

var output = {
    index: 'www/',
    images: 'www/images',
    js: 'www',
    css: 'www',
    template: 'www/templates',
    base: 'www'
};

var hashOptions = {
    format: '{name}.{hash}{ext}'
};

gulp.task('watch', function(){
    gulp.watch(paths.sass, ['sass']);
    gulp.watch(paths.css, ['stylesheet']);
    gulp.watch(paths.js, ['javascript']);
    gulp.watch(paths.templates , ['templates']);
});

gulp.task('sass', function(done) {
    return gulp.src(paths.sass)
        .pipe(concat('app.scss'))
        .pipe(sass())
        .on('error', sass.logError)
        .pipe(gulp.dest('app/styles'));
});

gulp.task('javascript', function(){
    var files = mainBowerFiles().concat();
    var jsFiles = [];
    for(var i = 0; i < files.length; i++){
        if(path.extname(files[i]).indexOf('js') >= 0){
            jsFiles.push(path.relative('', files[i]));
        }
    }
    jsFiles = jsFiles.concat(paths.js);
    gulp.src(jsFiles)
        .pipe(concat('app.js'))
        .pipe(browserify())
        .pipe(gulp.dest(output.js));
});

gulp.task('stylesheet', function(){
    var files = mainBowerFiles().concat();
    var cssFiles = [];
    for(var i = 0; i < files.length; i++){
        if(path.extname(files[i]).indexOf('css') >= 0){
            cssFiles.push(path.relative('', files[i]));
        }
    }

    cssFiles = cssFiles.concat(paths.css);

    gulp.src(cssFiles, {base: clientBase})
        .pipe(concat('app.css'))
        .pipe(cleanCSS({
            rebase: true,
            relativeTo: clientBase,
            target: clientBase
        }))
        .pipe(gulp.dest(output.css));
});

gulp.task('templates', function(){
    return gulp.src(paths.templates)
        .pipe(rename({dirname: ''}))
        .pipe(gulp.dest(output.template));
});

gulp.task('clean', function() {
    return gulp.src('www/*', { read: false })
        .pipe(clean());
});

gulp.task('concatJs', ['clean'], function(){
    var files = mainBowerFiles().concat();
    var jsFiles = [];
    for(var i = 0; i < files.length; i++){
        if(path.extname(files[i]).indexOf('js') >= 0){
            jsFiles.push(path.relative('', files[i]));
        }
    }
    jsFiles = jsFiles.concat(paths.js);
    return gulp.src(jsFiles)
        .pipe(concat('app.js'))
        .pipe(browserify())
        .pipe(gulp.dest(output.js));
});

gulp.task('concatCss', ['clean', 'sass'], function(){
    var files = mainBowerFiles().concat();
    var cssFiles = [];
    for(var i = 0; i < files.length; i++){
        if(path.extname(files[i]).indexOf('css') >= 0){
            cssFiles.push(path.relative('', files[i]));
        }
    }

    cssFiles = cssFiles.concat(paths.css);

    return gulp.src(cssFiles, {base: clientBase})
        .pipe(concat('app.css'))
        .pipe(cleanCSS({
            rebase: true,
            relativeTo: 'app/styles',
            target: 'app'
        }))
        .pipe(gulp.dest(output.css));
});

gulp.task('copyTemplate', ['clean'], function(){
    return gulp.src(paths.templates)
        .pipe(rename({dirname: ''}))
        .pipe(gulp.dest(output.template));
});

gulp.task('copyResources', ['clean'], function(){
    var files = mainBowerFiles().concat();
    var resources = [];
    for(var i = 0; i < files.length; i++){
        if(path.extname(files[i]).indexOf('css') === -1 && path.extname(files[i]).indexOf('js') === -1){
            resources.push(path.relative('', files[i]));
        }
    }

    resources = resources.concat(paths.images);
    return gulp.src(resources, {base: clientBase})
        .pipe(gulp.dest(output.base));
});

gulp.task('copyIndex', ['clean'], function(){
    return gulp.src(paths.index)
        .pipe(gulp.dest(output.index));
});

gulp.task('minJs', ['concatJs'], function(){
    return gulp.src(output.js + '/*.js', {base: output.js})
        .pipe(clean())
        .pipe(hash(hashOptions))
        .pipe(browserify())
        .pipe(uglify())
        .pipe(gulp.dest(output.js));
});

gulp.task('minCss', ['concatCss'], function(){
    return gulp.src(output.css + '/*.css', {base: output.css})
        .pipe(clean())
        .pipe(hash(hashOptions))
        .pipe(gulp.dest(output.css));
});

var buildIndex = function(){
    var network = config[app];
    if(!network){
        throw 'the config \'' + app + '\' is undefined';
    }
    return gulp.src(output.index + '/index.html')
        .pipe(inject(gulp.src(output.js + '/*.js', {read: false, base: output.js}), {relative: true}))
        .pipe(inject(gulp.src(output.css + '/*.css', {read: false, base: output.css}), {relative: true}))
        .pipe(inject(gulp.src('./app.json', {read: false}), {
            starttag: 'window.HOST = "',
            endtag: '";',
            transform: function (filepath, file, i, length) {
                return network.host;
            }
        }))
        .pipe(inject(gulp.src('./app.json', {read: false}), {
            starttag: 'window.STATIC_HOST = "',
            endtag: '";',
            transform: function (filepath, file, i, length) {
                return network.staticHost;
            }
        }))
        .pipe(gulp.dest(output.index));
};

gulp.task('build', ['concatJs', 'concatCss', 'copyResources', 'copyIndex', 'copyTemplate'], function(){
    return buildIndex();
});

gulp.task('release', ['minJs', 'minCss','copyResources', 'copyIndex', 'copyTemplate'], function(){
    return buildIndex();
});

gulp.task('ionicServe', ['build', 'watch'], function(){
    var command = spawn('ionic', ['serve']);
    command.stdout.on('data', function(data){
        console.log(`${data}`);
    });
    command.stderr.on('data', function(data){
        console.log(`${data}`);
    });
    command.on('end', function(data){
        console.log(`${data}`);
        done();
    });
});