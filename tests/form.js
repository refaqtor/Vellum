define([
    'tests/utils',
    'chai',
    'jquery',
    'vellum/form',
    'vellum/tree',
    'text!static/form/alternate-root-node-name.xml',
    'text!static/form/question-referencing-other.xml',
    'text!static/form/hidden-value-in-group.xml'
], function (
    util,
    chai,
    $,
    form_,
    Tree,
    ALTERNATE_ROOT_NODE_NAME_XML,
    QUESTION_REFERENCING_OTHER_XML,
    HIDDEN_VALUE_IN_GROUP_XML
) {
    var Form = form_.Form,
        assert = chai.assert,
        call = util.call;

    describe("The form component", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should show warnings for broken references on delete mug", function (done) {
            call('loadXFormOrError', QUESTION_REFERENCING_OTHER_XML, function () {
                var blue = call("getMugByPath", "/data/blue"),
                    green = call("getMugByPath", "/data/green"),
                    black = call("getMugByPath", "/data/black");
                assert(util.isTreeNodeValid(green), "sanity check failed: green is invalid");
                assert(util.isTreeNodeValid(black), "sanity check failed: black is invalid");
                util.clickQuestion("blue");
                blue.form.removeMugFromForm(blue);
                assert(util.isTreeNodeValid(green), "green should be valid");
                assert(!util.isTreeNodeValid(black), "black should not be valid");
                done();
            });
        });

        it("should remove warnings when broken reference is fixed", function (done) {
            call('loadXFormOrError', QUESTION_REFERENCING_OTHER_XML, function () {
                var blue = call("getMugByPath", "/data/blue"),
                    black = call("getMugByPath", "/data/black");
                blue.form.removeMugFromForm(blue);
                assert(!util.isTreeNodeValid(black), "black should not be valid");
                blue = util.addQuestion("Text", "blue");
                assert(util.isTreeNodeValid(black),
                       "black should be valid after blue is added");
                done();
            });
        });

        it("should set non-standard form root node", function () {
            util.loadXML(ALTERNATE_ROOT_NODE_NAME_XML);
            var form = call("getData").core.form,
                blue = call("getMugByPath", "/other/blue");
            assert.equal(form.getBasePath(), "/other/");
            assert(blue !== null, "mug not found: /other/blue");
        });

        it("should update reference to hidden value in group", function () {
            util.loadXML(HIDDEN_VALUE_IN_GROUP_XML);
            var group = call("getMugByPath", "/data/group"),
                label = call("getMugByPath", "/data/group/label"),
                hidden = call("getMugByPath", "/data/group/hidden");

            chai.expect(label.p.relevantAttr).to.include("/data/group/hidden");
            group.p.nodeID = "x";
            assert.equal(group.getAbsolutePath(), "/data/x");
            assert.equal(label.getAbsolutePath(), "/data/x/label");
            assert.equal(hidden.getAbsolutePath(), "/data/x/hidden");
            chai.expect(label.p.relevantAttr).to.include("/data/x/hidden");
        });

        it("should update reference to moved hidden value in output tag", function () {
            util.loadXML(HIDDEN_VALUE_IN_GROUP_XML);
            var form = call("getData").core.form,
                label = call("getMugByPath", "/data/group/label"),
                hidden = call("getMugByPath", "/data/group/hidden");

            chai.expect(label.p.relevantAttr).to.include("/data/group/hidden");
            chai.expect(label.p.labelItextID.defaultValue()).to.include("/data/group/hidden");
            form.moveMug(hidden, null, "first");
            assert.equal(hidden.getAbsolutePath(), "/data/hidden");
            chai.expect(label.p.relevantAttr).to.include("/data/hidden");
            chai.expect(label.p.labelItextID.defaultValue()).to.include("/data/hidden");
        });

        it("should merge data-only nodes with control nodes", function () {
            var form = new Form({}),
                values = [];

            form.dataTree = makeTree("data", ["a", "x1", "b", "x2", "c"]);
            form.controlTree = makeTree("control", ["a", "b", "c"]);

            form.mergedTreeMap(function (v) { values.push(v.id); });
            assert.equal(values.join(" "), "a x1 b x2 c");
        });

        it("should prefer control tree order on merge", function () {
            var form = new Form({}),
                values = [];

            form.dataTree = makeTree("data", ["a", "x1", "b", "x2", "c"]);
            form.controlTree = makeTree("control", ["a", "c", "b"]);

            form.mergedTreeMap(function (v) { values.push(v.id); });
            assert.equal(values.join(" "), "a c b x1 x2");
        });
    });

    // helper functions

    function makeTree(name, data) {
        var tree = new Tree(name, name),
            mug;
        for (var i = 0; i < data.length; i++) {
            mug = {id: data[i], getNodeID: function () { return this.id; }};
            mug.options = {isDataOnly: (data[i][0] === "x")};
            tree.insertMug(mug, 'into');
        }
        return tree;
    }
});
