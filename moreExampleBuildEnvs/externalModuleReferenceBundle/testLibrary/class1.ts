/// <reference path="class2.ts" />

module TestLibrary {
    export class Class1 extends Class2 {
        constructor() {
            super();
            console.log("testLibrary.class1");
        }
    }
}