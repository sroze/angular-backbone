/**
 * Backbone proxy for AngularJS
 * @version v1.0.0
 * @link https://github.com/sroze/angular-backbone/
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */

/* commonjs package manager support (eg componentjs) */
if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){
  module.exports = 'angular-backbone';
}

(function (window, angular, undefined) {
'use strict';

angular.module('angular-backbone', ['backbone', 'underscore'])
    /**
     * A backbone model extension that contains the model proxy
     * and transform sync promises.
     *
     */
    .factory('BackboneModel', function (BackbonePromiseProxy, BackboneModelProxy) {
        return Backbone.Model.extend({
            sync: function () {
                return BackbonePromiseProxy(Backbone.sync.apply(this, arguments));
            },
            proxy: function () {
                if (!this.angularProxy) {
                    this.angularProxy = new BackboneModelProxy(this);
                }

                return this.angularProxy;
            }
        });
    })
    .factory('BackboneCollection', function (BackbonePromiseProxy, BackboneCollectionProxy) {
        return Backbone.Collection.extend({
            sync: function () {
                return BackbonePromiseProxy(Backbone.sync.apply(this, arguments));
            },
            proxy: function () {
                if (!this.angularProxy) {
                    this.angularProxy = new BackboneCollectionProxy(this);
                }

                return this.angularProxy;
            }
        });
    })
    /**
     * `BackbonePromiseProxy` service is an helper that transform
     * the Backbone promise (which is a jQuery promise) into an AngularJS
     * promise ($q).
     *
     */
    .factory('BackbonePromiseProxy', function ($q) {
        return function (promise) {
            var deferred = $q.defer();
            promise.done(function(data){
                deferred.resolve(data);
            }).fail(function(error){
                deferred.reject(error);
            }).progress(function(data){
                deferred.notify(data);
            });

            return deferred.promise;
        }
    })
    /**
     * `BackboneCollectionProxy` service helps to create a collection
     * proxy.
     *
     */
    .factory('BackboneCollectionProxy', function (BackboneProxifier, BackboneModelProxy) {
        return function CollectionProxy (collection)
        {
            this.originalModels = collection.models;

            // Creating a proxy between functions
            BackboneProxifier.proxifyPrototype(this, collection);
            BackboneProxifier.proxifyProperties(this, collection);

            // Overrides the models
            this.models = [];
            for (var i = 0; i < this.originalModels.length; i++) {
                this.models.push(new BackboneModelProxy(this.originalModels[i]));
            }
        };
    })
    /**
     * `BackboneModelProxy` service is an helper that create a proxy for
     * Backbone models that can be used as simple objects in the AngularJS
     * view.
     *
     * It must be called one the object is synchronized.
     *
     */
    .factory('BackboneModelProxy', function (BackboneProxifier) {
        return function ModelProxy (model)
        {
            this.originalModel = model;

            // Keep a fallback to the `attributes` property.
            this.attributes = model.attributes;

            // Creating a proxy between functions
            BackboneProxifier.proxifyPrototype(this, model);
            BackboneProxifier.proxifyProperties(this, model);

            // Creating a proxy between attributes, and override
            // functions if some of them exists.
            for (var key in model.attributes) {
                BackboneProxifier.proxifyModelAttribute(this, model, key);
            }

            // Proxify the `set` method in case of the new attribute
            // don't exists
            var setter = this.set, objectReference = this;
            if (typeof setter == 'function') {
                this.set = function (key, value) {
                    if (objectReference[key] == undefined) {
                        BackboneProxifier.proxifyModelAttribute(objectReference, model, key);
                    }

                    setter.apply(objectReference, arguments);
                }
            }
        }
    })
    /**
     * The `BackboneProxifier` service will be used by other backbone proxies
     * as an helper.
     *
     */
    .factory('BackboneProxifier', function () {
        return {
            proxifyPrototype: function (dst, src) {
                for (var key in src.__proto__) {
                    if (typeof src[key] == 'function') {
                        dst[key] = (function (attributeName) {
                            return function () {
                                return src[attributeName].apply(dst, arguments);
                            }
                        })(key);
                    }
                }
            },
            proxifyProperties: function (dst, src) {
                for (var key in src) {
                    this.proxifyProperty(dst, src, key);
                }
            },
            proxifyProperty: function (dst, src, key) {
                Object.defineProperty(dst, key, {
                    configurable: true,
                    get: (function(attributeName) {
                        return function () {
                            return src[attributeName];
                        }
                    })(key),
                    set: (function(attributeName) {
                        return function (value) {
                            src[attributeName] = value;
                        }
                    })(key)
                });
            },
            proxifyModelAttribute: function (dst, model, key) {
                Object.defineProperty(dst, key, {
                    configurable: true,
                    get: (function (attributeName) {
                        return function () {
                            return model.get(attributeName);
                        };
                    })(key),
                    set: (function (attributeName) {
                        return function (value) {
                            return model.set(attributeName, value);
                        }
                    })(key)
                });
            }
        }
    });})(window, window.angular);