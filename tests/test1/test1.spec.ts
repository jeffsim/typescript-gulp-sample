describe('Scrollbar tests', () => {

    it('should success', (done) => {
        var v = new Duality.Visual();
        expect(v !== undefined);
        done();
    });

    it('should also success', (done) => {
        var v = new Duality.Editor();
        expect(v !== undefined);
        done();
    });
});