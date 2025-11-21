import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunityMaps } from './community-maps';
describe('CommunityMaps', () => {
  let component: CommunityMaps;
  let fixture: ComponentFixture<CommunityMaps>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityMaps]
    })
    .compileComponents();
    fixture = TestBed.createComponent(CommunityMaps);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
