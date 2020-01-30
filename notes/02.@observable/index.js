"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DemoStore1 = /** @class */ (function () {
    function DemoStore1() {
        this.observedArray = ["foo", "bar", "hoo", "hee"];
    }
    return DemoStore1;
}());
var DemoStore = /** @class */ (function () {
    function DemoStore() {
        this.observedArray = ["foo", "bar", "hoo", "hee"];
    }
    __decorate([
        mobx.observable
    ], DemoStore.prototype, "observedArray", void 0);
    return DemoStore;
}());
console.log(DemoStore.prototype);
console.log(DemoStore1.prototype);
