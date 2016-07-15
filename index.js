'use strict';

const koa = require('koa');
const mount = require('koa-mount');
const Router = require('koa-router');
const logger = require('koa-logger');
const semver = require('semver');
const tar = require('tar-stream');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

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

            let pack = tar.pack();
            pack.entry({name: 'index.js'}, `console.log('${this.params.componentName}@${version}');\n`);
            let tarball = `${this.params.componentName}-${version}.tar`;
            let ws = fs.createWriteStream(path.resolve(`./archives/${tarball}`));
            pack.pipe(ws);

            this.body = {
                _tarball: `${this.request.host}/archives/${tarball}`,
                name: this.params.componentName,
                version: version,
                keywords: [],
                description: `description of ${this.params.componentName}.`,
                preinstall: '',
                author: 'component mock service',
                options: {},
                dependencies: mockComponents[this.params.componentName].dependencies
            };

        } else {
            return this.throw(404, 'Component not found');
        }

    } else {
        return this.throw(404, 'Component not found');
    }
});

app.use(logger());
app.use(mount('/v1', router.middleware()));

app.listen(3000);
