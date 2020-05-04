"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DemoStore = /** @class */ (function () {
    function DemoStore() {
        this.observedArray = ["a", "b", "c", "d"];
    }
    __decorate([
        mobx.observable
    ], DemoStore.prototype, "observedArray", void 0);
    return DemoStore;
}());
var demoStoreInstance = new DemoStore();
console.log(demoStoreInstance.observedArray);
var reaction1 = mobx.autorun(function (reaction) {
    return console.log(demoStoreInstance.observedArray.join(","));
});
var reaction2 = mobx.reaction(function () { return demoStoreInstance.observedArray.length; }, function (length, reaction) {
    console.log({ length: length, reaction: reaction });
});
demoStoreInstance.observedArray[1] = "b1";
demoStoreInstance.observedArray.push("e");
demoStoreInstance.observedArray = ["a2", "b2", "c2", "d2"];
