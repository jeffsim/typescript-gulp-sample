describe('Scrollbar tests', () => {

    it('should succeed', (done) => {
        var v = new Duality.Visual();
        expect(v.test() == "asdf")
        done();
    });

    it('should also succeed', (done) => {
        var e = new Duality.Editor();
        expect(e.test() == "qwer")
        done();
    });
});