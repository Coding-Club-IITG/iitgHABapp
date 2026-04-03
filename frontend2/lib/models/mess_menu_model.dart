class MenuItemModel {
  final String id;
  final String name;
  final String type;
  bool isLiked;

  MenuItemModel({
    required this.id,
    required this.name,
    required this.type,
    required this.isLiked,
  });

  factory MenuItemModel.fromJson(Map<String, dynamic> json) => MenuItemModel(
        id: json['_id'] ?? '',
        name: json['name'] ?? '',
        type: json['type'] ?? '',
        isLiked: json['isLiked'] ?? false,
      );
}

class MenuModel {
  final String messID;
  final String day;
  final String id;
  final String type;
  final String startTime;
  final String endTime;
  final List<MenuItemModel> items;

  MenuModel({
    required this.messID,
    required this.day,
    required this.id,
    required this.type,
    required this.startTime,
    required this.endTime,
    required this.items,
  });

  factory MenuModel.fromJson(Map<String, dynamic> json) => MenuModel(
        messID: json['messId'] ?? '',
        day: json['day'] ?? '',
        id: json['_id'] ?? '',
        type: json['type'] ?? '',
        startTime: json['startTime'] ?? '',
        endTime: json['endTime'] ?? '',
        items: (json['items'] as List?)
                ?.map((item) =>
                    MenuItemModel.fromJson(item as Map<String, dynamic>))
                .toList() ??
            [],
      );
}
