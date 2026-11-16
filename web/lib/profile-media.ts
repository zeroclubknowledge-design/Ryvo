export const PROFILE_PHOTO_BUCKET="profile-photos";
export const MAX_PROFILE_PHOTO_BYTES=5*1024*1024;
export const profileBanners=[
  {src:"/other-side.png",alt:"Ryvo’s shared player cover"},
];
// Add the supplied covers here. Every player sees the same cover for each UTC day.
export function profileBannerAt(time:number){return profileBanners[Math.floor(time/86400000)%profileBanners.length]}
export function ownedAvatarPath(userId:string,path:unknown):path is string {
 return typeof path==="string"&&path.startsWith(`${userId}/`)&&/^avatar-[a-f0-9-]{36}\.jpg$/.test(path.slice(userId.length+1));
}
export function validateProfilePhoto(file:{type:string;size:number}){
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Choose a JPG, PNG or WebP photo.");
 if(file.size<=0||file.size>MAX_PROFILE_PHOTO_BYTES)throw Error("Choose a photo smaller than 5 MB.");
}
