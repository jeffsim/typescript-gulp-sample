declare namespace Duality {
    class Visual {
        constructor();
        test(): string;
    }
}
/// <reference path="Visual.d.ts" />
declare namespace Duality {
    class Label extends Visual {
        constructor();
    }
}
/// <reference path="Visual.d.ts" />
declare namespace Duality {
    class TextBox extends Visual {
        constructor();
    }
}
/// <reference path="controls/Visual.d.ts" />
/// <reference path="controls/Label.d.ts" />
/// <reference path="controls/TextBox.d.ts" />
declare namespace Duality {
    class Editor extends Visual {
        constructor();
        test(): string;
    }
}
