import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
interface Post {
  _id: string;
  author: string;
  authorUsername: string;
  content: string;
  createdAt: Date;
  likes: number;
  likedBy: string[];
}
interface CommunityMap {
  _id: string;
  name: string;
  authorUsername: string;
  plays: number;
  rating: number;
  upvotes: number;
  mapImage: string;
  description: string;
}
@Component({
  selector: 'app-community',
  imports: [CommonModule, FormsModule],
  templateUrl: './community.html',
  styleUrl: './community.css',
})
export class Community implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = 'http://localhost:3000/api';
  private router = inject(Router);
  newPostContent: string = '';
  showNewPostForm: boolean = false;
  posts: Post[] = [];
  maps: CommunityMap[] = [];
  ngOnInit() {
    this.loadPosts();
    this.loadPopularMaps();
  }
  loadPopularMaps() {
    this.http.get<CommunityMap[]>(`${this.apiUrl}/maps/popular?limit=3`).subscribe({
      next: (maps) => {
        this.maps = maps;
      },
      error: (error) => {
      }
    });
  }
  loadPosts() {
    this.http.get<Post[]>(`${this.apiUrl}/posts`).subscribe({
      next: (posts) => {
        this.posts = posts;
      },
      error: (error) => {
      }
    });
  }
  toggleNewPostForm() {
    this.showNewPostForm = !this.showNewPostForm;
    if (!this.showNewPostForm) {
      this.newPostContent = '';
    }
  }
  createPost() {
    if (!this.newPostContent.trim()) return;
    const userId = this.authService.userId();
    if (!userId) {
      alert('Debes iniciar sesión para crear posts');
      return;
    }
    this.http.post(`${this.apiUrl}/posts`, {
      userId: userId,
      content: this.newPostContent
    }).subscribe({
      next: () => {
        this.newPostContent = '';
        this.showNewPostForm = false;
        this.loadPosts(); 
      },
      error: (error) => {
        alert('Error al crear el post');
      }
    });
  }
  likePost(post: Post) {
    const userId = this.authService.userId();
    if (!userId) {
      alert('Debes iniciar sesión para dar like');
      return;
    }
    this.http.post(`${this.apiUrl}/posts/${post._id}/like`, { userId }).subscribe({
      next: (updatedPost: any) => {
        const index = this.posts.findIndex(p => p._id === post._id);
        if (index !== -1) {
          this.posts[index] = updatedPost;
        }
      },
      error: (error) => {
      }
    });
  }
  hasLiked(post: Post): boolean {
    const userId = this.authService.userId();
    return userId ? post.likedBy.includes(userId) : false;
  }
  playMap(map: CommunityMap) {
    this.http.post(`${this.apiUrl}/maps/${map._id}/play`, {}).subscribe({
      next: (updatedMap: any) => {
        map.plays = updatedMap.plays;
      },
      error: (error) => {
      }
    });
    this.router.navigate(['/game']);
  }
  getMapImageUrl(map: CommunityMap): string {
    return `http://localhost:3000${map.mapImage}`;
  }
  goToUploadMap() {
    const userId = this.authService.userId();
    if (!userId) {
      alert('Debes iniciar sesión para subir mapas');
      return;
    }
    this.router.navigate(['/map-upload']);
  }
  goToCommunityMaps() {
    this.router.navigate(['/community-maps']);
  }
}
