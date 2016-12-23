describe('Scrollbar tests', () => {

    it('should succeed', (done) => {
        var v = new Duality.Visual();
        expect(v !== undefined);
        done();
    });

    it('should also succeed', (done) => {
        var v = new Duality.Editor();
        expect(v !== undefined);
        done();
    });
});