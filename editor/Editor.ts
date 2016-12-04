namespace Duality {
    export class Editor extends Visual {
        constructor() {
            super();
            console.log("EDITOR");
            new Label();
            new TextBox();
        }

        test() : string {
            return "qwer";
        }        
    }
}