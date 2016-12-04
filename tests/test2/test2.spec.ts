describe('Scrollbar tests', () => {

    it('should success', (done) => {
        var v = new Duality.Visual();
        expect(v.test() == "asdf")
        done();
    });

    it('should also success', (done) => {
        var e = new Duality.Editor();
        expect(e.test() == "qwer")
        done();
    });
});