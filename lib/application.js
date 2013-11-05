$(document).ready(function() {
    console.log("Hello from jquery!");

    app = new ApplicationModel();
    ko.applyBindings(app);
});

function ApplicationModel() {
    var self = this;

    this.title="Do It!";
}

