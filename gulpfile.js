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
var browserify = require('browserify');
var babel = require('gulp-babel');
var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');
var streamqueue = require('streamqueue');
var html2pug = require('gulp-html2pug');
var html2jade   = require('gulp-html2jade');

var app = argv.app || 'dev';
var clientBase = 'app';
var paths = {
    index: [
        'app/index.html'
    ],
    images: [
        'app/images/**/*'
    ],
    mainJs: [
        './app/main/app.js'
    ],
    js: [
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
    gulp.watch(paths.mainJs, ['javascript']);
    gulp.watch(paths.templates , ['templates']);
});

gulp.task('sass', function(done) {
    return gulp.src(paths.sass)
        .pipe(concat('app.scss'))
        .pipe(sass())
        .on('error', sass.logError)
        .pipe(gulp.dest('app/styles'));
});

var javascript = function(){
    var files = mainBowerFiles().concat();
    var jsFiles = [];
    for(var i = 0; i < files.length; i++){
        if(path.extname(files[i]).indexOf('js') >= 0){
            jsFiles.push(path.relative('', files[i]));
        }
    }
    var bundle = browserify(paths.mainJs)
        .bundle()
        .pipe(source('app.js'))
        .pipe(buffer())
        .pipe(babel({
            presets: ['es2015']
        }));
    return streamqueue({objectMode: true}, gulp.src(jsFiles), bundle, gulp.src(paths.js))
        .pipe(concat('app.js'))
        .pipe(gulp.dest(output.js));
};

// gulp.task('test', ['clean'], function(){
//    return  utput.js));

// })

gulp.task('javascript', function(){
    return javascript();
});

var stylesheet = function(){
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
};

gulp.task('stylesheet', function(){
    return stylesheet();
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
    return javascript();
});

gulp.task('concatCss', ['clean', 'sass'], function(){
    return stylesheet();
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

gulp.task('minJs', function(){
    var files = mainBowerFiles().concat();
    var jsFiles = [];
    for(var i = 0; i < files.length; i++){
        if(path.extname(files[i]).indexOf('js') >= 0){
            jsFiles.push(path.relative('', files[i]));
        }
    }
    var bundle = browserify(paths.mainJs)
        .bundle()
        .pipe(source('app.js'))
        .pipe(buffer())
        .pipe(babel({
            presets: ['es2015']
        }));
    return streamqueue({objectMode: true},
        gulp.src(jsFiles),
        bundle,
        gulp.src(paths.js))
        .pipe(concat('app.js'))
        .pipe(uglify())
        .pipe(hash(hashOptions))
        .pipe(gulp.dest(output.js));
    // return browserify('./' + output.js + '/app.js')
    //     .transform('babelify', {
    //         presets: ['babili']
    //     })
    //     .bundle()
    //     .pipe(source('app.js'))
    //     .pipe(buffer())
    //     .pipe(clean())
    //     .pipe(hash(hashOptions))
    //     // .pipe(uglify({

    //     // }))
    //     // .on('error', function(message, filename, line){
    //     //     console.error(message);
    //     //     console.error(filename);
    //     //     console.error(line);
    //     // })
    //     .pipe(gulp.dest(output.js));
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
        .pipe(inject(gulp.src(output.js + '/*.js', {read: false, base: output.js}), {
            relative: true,
            transform: function(filepath, file, i, length){
                return '<script src="' + path.join(network.staticHost || '', filepath) + '"></script>';
            }
        }))
        .pipe(inject(gulp.src(output.css + '/*.css', {read: false, base: output.css}), {
            relative: true,
            transform: function(filepath, file, i, length){
                return '<link href="' + path.join(network.staticHost || '', filepath) + '" rel="stylesheet">'
            }
        }))
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

var PUBLISH_PATH = '../MADao';
var TEMPLATE_PATH = path.join(PUBLISH_PATH, 'server', 'templates');
var STATIC_PATH = path.join(PUBLISH_PATH, 'server', 'static', 'mobile');
gulp.task('publicClean', function(){
    return gulp.src([
            path.join(STATIC_PATH, '**', '*.*'),
            path.join(TEMPLATE_PATH, 'mobile.pug')
        ], {read: false})
        .pipe(clean({force: true}));
});

gulp.task('publishIndex', ['release'], function(){
    var publishPath = TEMPLATE_PATH;
    return gulp.src('www/index.html', {base: 'www'})
        .pipe(html2jade())
        .pipe(rename('mobile.pug'))
        .pipe(gulp.dest(publishPath));
});

gulp.task('publish', ['release', 'publishIndex', 'publicClean'], function(){
    var publishPath = STATIC_PATH;
    return gulp.src('www/**/*.*', {base: 'www'})
        .pipe(gulp.dest(publishPath));
});
