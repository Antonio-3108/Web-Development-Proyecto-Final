import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapUpload } from './map-upload';
describe('MapUpload', () => {
  let component: MapUpload;
  let fixture: ComponentFixture<MapUpload>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapUpload]
    })
    .compileComponents();
    fixture = TestBed.createComponent(MapUpload);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
