'use strict';

const koa = require('koa');
const mount = require('koa-mount');
const Router = require('koa-router');
const logger = require('koa-logger');
const send = require('koa-send');
const semver = require('semver');
const tarPack = require('tar-pack');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const crypto = require('crypto');

const app = koa();

const mockComponents = {
    cmp1: {
        versions: ['0.9.1', '1.0.0', '1.2.1', '2.0.0'],
        dependencies: { cmp4: '^1.0.0' }
    },
    cmp2: {
        versions: ['0.9.1', '1.0.0', '1.2.1', '2.0.0'],
        dependencies: {}
    },
    cmp3: {
        versions: ['0.9.1', '1.0.0', '1.2.1', '2.0.0'],
        dependencies: { cmp5: '*' , cmp6: '^1.0.0' }
    },
    cmp4: {
        versions: ['0.9.1', '1.0.0', '1.2.1', '2.0.0'],
        dependencies: { cmp5: '^1.0.0', cmp6: '^1.0.0' }
    },
    cmp5: {
        versions: ['0.9.1', '1.0.0', '1.2.1', '2.0.0'],
        dependencies: { cmp7: '*' }
    },
    cmp6: {
        versions: ['0.9.1', '1.0.0', '1.2.1', '2.0.0'],
        dependencies: {}
    },
    cmp7: {
        versions: ['0.9.1', '1.0.0', '1.2.1', '2.0.0'],
        dependencies: { cmp8: '1.2.1' }
    },
    cmp8: {
        versions: ['0.9.1', '1.0.0', '1.2.1', '2.0.0'],
        dependencies: {}
    }
};

const router = new Router();

router.get('/find/:componentName', function *() {
    let versionRange = this.request.query.version;
    if (_.has(mockComponents, this.params.componentName)) {
        let matchedVersions = mockComponents[this.params.componentName].versions.filter(version => {
            return semver.satisfies(version, versionRange);
        });

        if (matchedVersions.length > 0) {
            let version = matchedVersions.sort((a, b) => {
                // sort versions desc
                if (semver.gt(a, b)) {
                    return -1;
                } else if (semver.lt(a, b)) {
                    return 1;
                } else {
                    return 0;
                }
            })[0];


            // mock
            let tarball = `${this.params.componentName}-${version}.tar.gz`;
            let tarballPath = path.resolve(`./archives/${tarball}`);
            try {
                let tarballContent = fs.readFileSync(tarballPath);
                this.body = {
                    _tarball: `${this.request.origin}/archives/${tarball}`,
                    _tarballHash: crypto.createHash('sha256').update(tarballContent).digest('hex'),
                    name: this.params.componentName,
                    version: version,
                    keywords: [],
                    description: `description of ${this.params.componentName}.`,
                    preinstall: '',
                    author: 'component mock service',
                    options: {},
                    dependencies: mockComponents[this.params.componentName].dependencies
                };
            } catch(e) {
                if (e.code === 'ENOENT') {
                    yield new Promise((resolve, reject) => {
                        let ws = fs.createWriteStream(tarballPath);
                        tarPack.pack(path.resolve('./tpl'), {fromBase: true})
                        .pipe(ws)
                        .on('error', err => reject(err))
                        .on('close', () => {
                            let tarballContent = fs.readFileSync(path.resolve(`./archives/${tarball}`));
                            this.body = {
                                _tarball: `${this.request.origin}/archives/${tarball}`,
                                _tarballHash: crypto.createHash('sha256').update(tarballContent).digest('hex'),
                                name: this.params.componentName,
                                version: version,
                                keywords: [],
                                description: `description of ${this.params.componentName}.`,
                                preinstall: '',
                                author: 'component mock service',
                                options: {},
                                dependencies: mockComponents[this.params.componentName].dependencies
                            };
                            resolve();
                        });
                    });
                }
            }


        } else {
            return this.throw(404, 'Component not found');
        }

    } else {
        return this.throw(404, 'Component not found');
    }
});


app.use(logger());
app.use(mount('/v1', router.middleware()));

app.use(function *() {
    let tarballPath = path.join(__dirname, this.path);
    if (this.path.startsWith('/archives')) {
        try {
            fs.accessSync(tarballPath);
        } catch (err) {
            return this.throw(404, 'Component not found');
        }
    } else {
        return this.throw(404, 'Component not found');
    }
    yield send(this, this.path, { root: __dirname });
});

app.listen(3000);
