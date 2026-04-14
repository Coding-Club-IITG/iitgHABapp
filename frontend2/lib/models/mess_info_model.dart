/// Round half-up to 2 decimal places (matches API / Mongo `$round` …, 2).
double roundToTwoDecimals(num? value) {
  if (value == null) return 0.0;
  final d = value.toDouble();
  return (d * 100).round() / 100;
}

class MessInfoModel {
  final String id;
  final String name;
  final String hostelId;
  /// Net OPI (same scale as spreadsheet).
  final double rating;
  final int ranking;
  /// Subscriber feedback % (0–100).
  final double feedbackPercentage;
  final String hostelName;

  MessInfoModel({
    required this.id,
    required this.name,
    required this.hostelId,
    required this.rating,
    required this.ranking,
    required this.feedbackPercentage,
    required this.hostelName,
  });

  factory MessInfoModel.fromJson(Map<String, dynamic> json) {
    return MessInfoModel(
      id: json['_id'],
      name: json['name'],
      hostelId: json['hostelId'],
      rating: roundToTwoDecimals(json['rating'] as num?),
      ranking: (json['ranking'] as num?)?.toInt() ?? 0,
      feedbackPercentage:
          roundToTwoDecimals(json['feedbackPercentage'] as num?),
      hostelName: json['hostelName'],
    );
  }
}


//mapping hostelname with messid,messname,rating,ranking

class HostelData {
  final String messid;
  final String messname;
  final double rating;
  final int ranking;
  final double feedbackPercentage;

  HostelData({
    required this.messid,
    required this.messname,
    required this.rating,
    required this.ranking,
    required this.feedbackPercentage,
  });
}

// Function to map hostels by name
Map<String, HostelData> mapHostelsByName(List<MessInfoModel> hostels) {
  Map<String, HostelData> hostelMap = {};

  for (MessInfoModel hostel in hostels) {
    hostelMap[hostel.hostelName] = HostelData(
      messid: hostel.id,
      messname: hostel.name,
      rating: hostel.rating,
      ranking: hostel.ranking,
      feedbackPercentage: hostel.feedbackPercentage,
    );
  }

  return hostelMap;
}
