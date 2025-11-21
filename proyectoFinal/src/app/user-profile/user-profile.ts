import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

interface User {
  name: string;
  bio?: string;
  profileImage?: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    mapsCreated: number;
    postsCreated: number;
  };
}

interface UserMap {
  id: number;
  name: string;
  description?: string;
  plays: number;
  rating: number;
  isEditing?: boolean;
  editedName?: string;
  editedDescription?: string;
}

interface UserPost {
  _id: string;
  content: string;
  createdAt: Date;
  likes: number;
}

@Component({
  selector: 'app-user-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
})
export class UserProfile implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  private apiUrl = environment.apiUrl;

  isEditing: boolean = false;
  isLoading: boolean = true;

  user: User = {
    name: '',
    bio: '',
    profileImage: '',
    stats: {
      gamesPlayed: 0,
      wins: 0,
      mapsCreated: 0,
      postsCreated: 0
    }
  };

  editedUser: User = { ...this.user };

  userMaps: UserMap[] = [];
  userPosts: UserPost[] = [];

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/create-profile']);
      return;
    }

    this.authService.restoreSession();
    this.loadUserData();
  }

  loadUserData() {
    const userId = this.authService.userId(); // ✅ CORRECTO

    if (!userId) {
      this.router.navigate(['/create-profile']);
      return;
    }

    this.http.get(`${this.apiUrl}/users/${userId}`).subscribe({
      next: (response: any) => {
        this.user = {
          name: response.username,
          bio: response.bio || 'Jugador de DashWare',
          profileImage: response.profileImage || '',
          stats: response.stats
        };
        this.editedUser = { ...this.user };
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });

    this.loadUserPosts();
    this.loadUserMaps();
  }

  loadUserMaps() {
    const userId = this.authService.userId(); // ✅

    if (!userId) return;

    this.http.get<any[]>(`${this.apiUrl}/maps/user/${userId}`).subscribe({
      next: (maps) => {
        this.userMaps = maps.map(map => ({
          id: map._id,
          name: map.name,
          description: map.description || '',
          plays: map.plays,
          rating: map.rating,
          isEditing: false,
          editedName: map.name,
          editedDescription: map.description || ''
        }));
      }
    });
  }

  loadUserPosts() {
    const userId = this.authService.userId(); // ✅

    if (!userId) return;

    this.http.get<UserPost[]>(`${this.apiUrl}/posts/user/${userId}`).subscribe({
      next: (posts) => {
        this.userPosts = posts;
      }
    });
  }

  toggleEdit() {
    this.isEditing = true;
    this.editedUser = { ...this.user };
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  viewPublicProfile() {
    this.router.navigate(['/user', this.user.name]);
  }

  saveProfile() {
    const userId = this.authService.userId(); // ✅

    if (!userId) return;

    this.http.put(`${this.apiUrl}/users/${userId}`, {
      username: this.editedUser.name,
      bio: this.editedUser.bio
    }).subscribe({
      next: () => {
        this.user = { ...this.editedUser };
        this.isEditing = false;
      }
    });
  }

  cancelEdit() {
    this.isEditing = false;
    this.editedUser = { ...this.user };
  }

  startEditMap(map: UserMap) {
    map.isEditing = true;
    map.editedName = map.name;
    map.editedDescription = map.description || '';
  }

  cancelEditMap(map: UserMap) {
    map.isEditing = false;
    map.editedName = map.name;
    map.editedDescription = map.description || '';
  }

  saveMapEdit(map: UserMap) {
    const userId = this.authService.userId(); // ✅

    if (!userId) return;
    if (!map.editedName?.trim()) {
      alert('El nombre del mapa no puede estar vacío');
      return;
    }

    this.http.put(`${this.apiUrl}/maps/${map.id}`, {
      userId,
      name: map.editedName,
      description: map.editedDescription
    }).subscribe({
      next: () => {
        map.name = map.editedName!;
        map.description = map.editedDescription;
        map.isEditing = false;
      },
      error: (error) => {
        alert('Error al editar el mapa: ' + (error.error?.message || error.message));
      }
    });
  }

  deleteMap(map: UserMap) {
    const userId = this.authService.userId(); // ✅

    if (!userId) {
      alert('Debes iniciar sesión para eliminar mapas');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar este mapa?')) return;

    this.http.delete(`${this.apiUrl}/maps/${map.id}?userId=${userId}`).subscribe({
      next: () => {
        const index = this.userMaps.indexOf(map);
        if (index > -1) {
          this.userMaps.splice(index, 1);
          this.user.stats.mapsCreated--;
        }
      },
      error: (error) => {
        alert(error.error?.message || 'Error al eliminar el mapa');
      }
    });
  }

  deletePost(post: UserPost) {
    const userId = this.authService.userId(); // ✅

    if (!userId) return;
    if (!confirm('¿Estás seguro de que quieres eliminar este post?')) return;

    this.http.delete(`${this.apiUrl}/posts/${post._id}`, {
      body: { userId }
    }).subscribe({
      next: () => {
        const index = this.userPosts.indexOf(post);
        if (index > -1) {
          this.userPosts.splice(index, 1);
          this.user.stats.postsCreated--;
        }
      },
      error: () => {
        alert('Error al eliminar el post');
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const userId = this.authService.userId(); // ✅

    if (!userId) return;

    const formData = new FormData();
    formData.append('profile', file);
    formData.append('userId', userId);

    this.http.post(`${this.apiUrl}/upload/profile`, formData).subscribe({
      next: (response: any) => {
        this.user.profileImage = response.imageUrl;
        this.loadUserData();
      },
      error: (error) => {
        alert('Error al subir la imagen: ' + (error.error?.message || error.message));
      }
    });
  }

  getProfileImageUrl(): string {
    if (this.user.profileImage) {
      return this.user.profileImage; 
    }
    return '';
  }
}
