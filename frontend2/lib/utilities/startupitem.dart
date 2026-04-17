import 'package:flutter/foundation.dart';
import 'package:frontend2/apis/dio_client.dart';
import '../constants/endpoint.dart';
import '../models/mess_info_model.dart';

class MessInfoProvider with ChangeNotifier {
  List<MessInfoModel> _messList = [];
  Map<String, HostelData> _hostelMap = {};
  bool isLoading = true;

  //List<MessInfoModel> get hostels => _messList;
  Map<String, HostelData> get hostelMap =>
      _hostelMap; //getter for accessing pvt variables

  void applyMessInfoList(List<dynamic> data) {
    _messList = data
        .map((e) => MessInfoModel.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    _hostelMap = mapHostelsByName(_messList);
    isLoading = false;
    notifyListeners();
  }

  Future<void> fetchMessID() async {
    try {
      if (kDebugMode) debugPrint('api calling');
      final dio = DioClient().dio;
      final response = await dio.post(MessInfo.getMessInfo);
      if (response.statusCode == 200) {
        final data = response.data as List;
        if (kDebugMode) debugPrint('data is $data');
        _messList = data.map((e) => MessInfoModel.fromJson(e)).toList();
        _hostelMap = mapHostelsByName(_messList);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('API Error: $e');
      _messList = [];
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }
}
